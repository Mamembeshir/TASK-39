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

  return {
    uploadMedia: async ({ auth, files, purpose }) => {
      if (!Array.isArray(files) || files.length === 0) {
        throw createError(400, "NO_FILES", "At least one file is required");
      }
      if (!["review", "ticket", "content"].includes(purpose)) {
        throw createError(400, "INVALID_PURPOSE", "purpose must be one of review, ticket, content");
      }

      await fs.mkdir(MEDIA_UPLOAD_DIR, { recursive: true });
      const uploaded = [];

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

        const processedBuffer = await maybeCompressImage(file.buffer, declaredMime);
        const sha256 = crypto.createHash("sha256").update(processedBuffer).digest("hex");

        const existing = await mediaRepository.findMediaBySha256(sha256);
        if (existing) {
          await mediaRepository.incrementMediaRefCount(existing._id);
          uploaded.push({
            mediaId: existing._id.toString(),
            sha256,
            mime: existing.mime,
            byteSize: existing.byteSize,
            deduplicated: true,
          });
          continue;
        }

        const extension = ALLOWED_MEDIA_MIME[declaredMime];
        const fileName = `${sha256}.${extension}`;
        const storagePath = path.join(MEDIA_UPLOAD_DIR, fileName);
        await fs.writeFile(storagePath, processedBuffer, { flag: "wx" });

        try {
          const insert = await mediaRepository.insertMedia({
            sha256,
            byteSize: processedBuffer.length,
            mime: declaredMime,
            refCount: 1,
            purpose,
            storagePath: fileName,
            createdBy: auth?.sub ? new ObjectId(auth.sub) : null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          uploaded.push({
            mediaId: insert.insertedId.toString(),
            sha256,
            mime: declaredMime,
            byteSize: processedBuffer.length,
            deduplicated: false,
            url: `/media/files/${fileName}`,
          });
        } catch (error) {
          if (error && error.code === 11000) {
            const deduped = await mediaRepository.findAndIncrementBySha256(sha256);
            uploaded.push({
              mediaId: deduped._id.toString(),
              sha256,
              mime: deduped.mime,
              byteSize: deduped.byteSize,
              deduplicated: true,
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

    deleteMediaById: async ({ mediaId }) => {
      const media = await mediaRepository.findMediaById(mediaId);
      if (!media) {
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

      await mediaRepository.deleteMediaById(mediaId);
      if (media.storagePath) {
        await fs.rm(path.join(MEDIA_UPLOAD_DIR, media.storagePath), { force: true });
      }

      return {
        status: 200,
        body: { status: "ok" },
      };
    },
  };
}

module.exports = {
  createMediaService,
};
