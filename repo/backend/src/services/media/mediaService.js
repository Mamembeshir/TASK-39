const crypto = require("crypto");
const path = require("path");

function createMediaService(deps) {
  const {
    ALLOWED_MEDIA_MIME,
    createError,
    detectMimeFromMagicBytes,
    fs,
    MAX_UPLOAD_BYTES,
    mediaRepository,
    MEDIA_ENABLE_PROCESSING,
    MEDIA_UPLOAD_DIR,
    maybeCompressImage,
    ObjectId,
  } = deps;

  function getOwnedRefCount(media, actorId) {
    if (!actorId || !media) {
      return 0;
    }

    const ownerRefs = media.ownerRefs && typeof media.ownerRefs === "object" ? media.ownerRefs : null;
    const explicitCount = ownerRefs ? Number(ownerRefs[actorId]) : 0;
    if (Number.isFinite(explicitCount) && explicitCount > 0) {
      return explicitCount;
    }

    // ownerIds is the authoritative ownership list; createdBy alone is not sufficient
    // because cleanupMediaOwnerRef removes from ownerIds but leaves createdBy in place,
    // so using createdBy as a fallback would allow a creator to keep accessing media
    // after their stake has been fully revoked.
    const ownerIds = Array.isArray(media?.ownerIds)
      ? media.ownerIds.map((owner) => owner?.toString?.() || String(owner))
      : [];
    return ownerIds.includes(actorId) ? 1 : 0;
  }

  function canManageMedia(auth, media) {
    const roles = Array.isArray(auth?.roles) ? auth.roles : [];
    if (roles.some((role) => ["administrator", "service_manager", "moderator"].includes(role))) {
      return true;
    }

    const actorId = auth?.userId || auth?.sub || null;
    return getOwnedRefCount(media, actorId) > 0;
  }

  function getMediaScope(purpose) {
    return ["content", "public_asset"].includes(purpose) ? "public" : "private";
  }

  function getDedupNamespace(purpose) {
    return purpose;
  }

  function canUploadPurpose(auth, purpose) {
    if (!["content", "public_asset"].includes(purpose)) {
      return true;
    }

    const roles = Array.isArray(auth?.roles) ? auth.roles : [];
    return roles.some((role) => ["administrator", "service_manager", "moderator"].includes(role));
  }

  return {
    uploadMedia: async ({ auth, crop, files, purpose }) => {
      if (!Array.isArray(files) || files.length === 0) {
        throw createError(400, "NO_FILES", "At least one file is required");
      }
      if (!["review", "ticket", "content", "public_asset"].includes(purpose)) {
        throw createError(400, "INVALID_PURPOSE", "purpose must be one of review, ticket, content, public_asset");
      }
      if (!canUploadPurpose(auth, purpose)) {
        throw createError(403, "FORBIDDEN_MEDIA_PURPOSE", "Only privileged staff can upload content or public assets");
      }

      await fs.mkdir(MEDIA_UPLOAD_DIR, { recursive: true });
      const uploaded = [];
      const storageScope = getMediaScope(purpose);
      const dedupNamespace = getDedupNamespace(purpose);

      for (const file of files) {
        const declaredMime = file.mimetype;
        const detectedMime = detectMimeFromMagicBytes(file.buffer);
        if (!declaredMime || !ALLOWED_MEDIA_MIME[declaredMime]) {
          throw createError(400, "UNSUPPORTED_MEDIA_TYPE", "Only JPEG, PNG, GIF, or WEBP images are allowed");
        }
        if (!detectedMime || declaredMime !== detectedMime) {
          throw createError(400, "MIME_MISMATCH", "File content does not match declared MIME type");
        }
        if (file.size > MAX_UPLOAD_BYTES) {
          throw createError(400, "FILE_TOO_LARGE", "File exceeds maximum size of 10 MB");
        }

        const processedBuffer = await maybeCompressImage(file.buffer, declaredMime, crop);
        const sha256 = crypto.createHash("sha256").update(processedBuffer).digest("hex");

        const existing = await mediaRepository.findMediaBySha256(sha256, dedupNamespace, purpose);
        if (existing) {
          const ownerId = auth?.sub ? new ObjectId(auth.sub) : null;
          await mediaRepository.incrementMediaRefCount(existing._id, ownerId);
          uploaded.push({
            mediaId: existing._id.toString(),
            sha256,
            mime: existing.mime,
            byteSize: existing.byteSize,
            deduplicated: true,
            url: (existing.storageScope || getMediaScope(existing.purpose)) === "public"
              ? `/media/files/${existing.storagePath}`
              : `/api/media/files/${existing._id.toString()}`,
          });
          continue;
        }

        const extension = ALLOWED_MEDIA_MIME[declaredMime];
        const fileName = `${sha256}.${extension}`;
        const scopedStoragePath = path.join(storageScope, fileName);
        const fullStoragePath = path.join(MEDIA_UPLOAD_DIR, scopedStoragePath);
        await fs.mkdir(path.dirname(fullStoragePath), { recursive: true });
        await fs.writeFile(fullStoragePath, processedBuffer, { flag: "wx" });

        try {
          const ownerId = auth?.sub ? new ObjectId(auth.sub) : null;
          const ownerRefs = ownerId ? { [ownerId.toString()]: 1 } : {};
          const insert = await mediaRepository.insertMedia({
            sha256,
            byteSize: processedBuffer.length,
            mime: declaredMime,
            refCount: 1,
            purpose,
            dedupNamespace,
            storageScope,
            storagePath: scopedStoragePath,
            createdBy: ownerId,
            ownerIds: ownerId ? [ownerId] : [],
            ownerRefs,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          uploaded.push({
            mediaId: insert.insertedId.toString(),
            sha256,
            mime: declaredMime,
            byteSize: processedBuffer.length,
            deduplicated: false,
            url: storageScope === "public"
              ? `/media/files/${scopedStoragePath}`
              : `/api/media/files/${insert.insertedId.toString()}`,
          });
        } catch (error) {
          if (error && error.code === 11000) {
            const ownerId = auth?.sub ? new ObjectId(auth.sub) : null;
            const deduped = await mediaRepository.findAndIncrementBySha256(sha256, dedupNamespace, ownerId, purpose);
            uploaded.push({
              mediaId: deduped._id.toString(),
              sha256,
              mime: deduped.mime,
              byteSize: deduped.byteSize,
              deduplicated: true,
              url: (deduped.storageScope || getMediaScope(deduped.purpose)) === "public"
                ? `/media/files/${deduped.storagePath}`
                : `/api/media/files/${deduped._id.toString()}`,
            });
          } else {
            throw error;
          }
        }
      }

      return {
        media: uploaded,
        processingEnabled: MEDIA_ENABLE_PROCESSING,
      };
    },

    deleteMediaById: async ({ auth, mediaId }) => {
      const media = await mediaRepository.findMediaById(mediaId);
      if (!media) {
        throw createError(404, "MEDIA_NOT_FOUND", "Media not found");
      }
      if (!canManageMedia(auth, media)) {
        throw createError(404, "MEDIA_NOT_FOUND", "Media not found");
      }

      const { contentRef, reviewRef, ticketRef } = await mediaRepository.findMediaReferences(mediaId);
      const references = [];
      if (reviewRef) {
        references.push("review");
      }
      if (ticketRef) {
        references.push("ticket");
      }
      if (contentRef) {
        references.push("content");
      }

      if (references.length > 0) {
        return {
          status: 409,
          body: {
            code: "MEDIA_IN_USE",
            message: `Media is referenced by ${references.join(", ")} and cannot be deleted`,
          },
        };
      }

      if ((media.refCount || 0) > 1) {
        const roles = Array.isArray(auth?.roles) ? auth.roles : [];
        const isPrivileged = roles.some((role) => ["administrator", "service_manager", "moderator"].includes(role));
        const actorId = auth?.userId || auth?.sub || null;
        const actorObjectId = actorId ? new ObjectId(actorId) : null;

        if (!isPrivileged && !actorObjectId) {
          throw createError(404, "MEDIA_NOT_FOUND", "Media not found");
        }

        const updated = await mediaRepository.decrementMediaRefCount(mediaId, isPrivileged ? null : actorObjectId);
        if (!updated) {
          throw createError(404, "MEDIA_NOT_FOUND", "Media not found");
        }

        if (!isPrivileged && actorId) {
          const remainingOwnerRefs = Number(updated.ownerRefs?.[actorId] ?? 0);
          if (!Number.isFinite(remainingOwnerRefs) || remainingOwnerRefs <= 0) {
            await mediaRepository.cleanupMediaOwnerRef(mediaId, actorObjectId);
          }
        }

        return {
          status: 200,
          body: { status: "ok" },
        };
      }

      await mediaRepository.deleteMediaById(mediaId);
      if (media.storagePath) {
        await fs.rm(path.join(MEDIA_UPLOAD_DIR, media.storagePath), { force: true });
      }

      return {
        status: 200,
        body: { status: "ok" },
      };
    },

    getMediaFileById: async ({ auth, mediaId }) => {
      const media = await mediaRepository.findMediaById(mediaId);
      if (!media) {
        throw createError(404, "MEDIA_NOT_FOUND", "Media not found");
      }
      if (!canManageMedia(auth, media)) {
        throw createError(404, "MEDIA_NOT_FOUND", "Media not found");
      }

      const filePath = path.resolve(MEDIA_UPLOAD_DIR, media.storagePath || "");
      const mediaRoot = path.resolve(MEDIA_UPLOAD_DIR) + path.sep;
      if (!filePath.startsWith(mediaRoot)) {
        throw createError(400, "INVALID_MEDIA_PATH", "Media path is invalid");
      }

      return {
        filePath,
        mime: media.mime || "application/octet-stream",
      };
    },
  };
}

module.exports = {
  createMediaService,
};
