function createContentService(deps) {
  const {
    buildContentVersion,
    contentRepository,
    createError,
    extractContentMediaRefs,
    mediaRepository,
    ObjectId,
    parseObjectIdArray,
    parseObjectIdOrNull,
    syncContentSearchDocument,
    writeAuditLog,
  } = deps;

  async function findContentOrThrow(contentId) {
    const content = await contentRepository.findContentById(contentId);
    if (!content) {
      throw createError(404, "CONTENT_NOT_FOUND", "Content not found");
    }
    return content;
  }

  function assertVersionExists(content, versionId) {
    const exists = (content.versions || []).some((version) => version.id.toString() === versionId.toString());
    if (!exists) {
      throw createError(404, "VERSION_NOT_FOUND", "Version not found");
    }
  }

  function findVersionOrThrow(content, versionId) {
    const version = (content.versions || []).find((item) => item.id.toString() === versionId.toString());
    if (!version) {
      throw createError(404, "VERSION_NOT_FOUND", "Version not found");
    }
    return version;
  }

  async function validateAndCollectMediaRefs({ contentBody, explicitMediaIds = [] }) {
    const extractedRefs = extractContentMediaRefs(contentBody, explicitMediaIds);
    const parsedRefs = [];
    for (const ref of extractedRefs) {
      const parsedRef = parseObjectIdOrNull(ref);
      if (!parsedRef) {
        throw createError(400, "INVALID_MEDIA_ID", "Content body references an invalid media id");
      }
      if (!parsedRefs.some((value) => value.toString() === parsedRef.toString())) {
        parsedRefs.push(parsedRef);
      }
    }

    const mediaDocs = await mediaRepository.findMediaByIds(parsedRefs);
    if (mediaDocs.length !== parsedRefs.length) {
      throw createError(400, "MEDIA_NOT_FOUND", "One or more content media files were not found");
    }

    for (const media of mediaDocs) {
      if (media.purpose !== "content") {
        throw createError(400, "INVALID_MEDIA_PURPOSE", "Only content media can be embedded in content bodies");
      }
    }

    return parsedRefs;
  }

  return {
    listPublishedContent: async () => {
      const contents = await contentRepository.findPublishedContentSummaries();
      return contents.map((content) => {
        const publishedVersion = (content.versions || []).find(
          (version) => version.id.toString() === content.publishedVersionId?.toString(),
        );

        return {
          id: content._id.toString(),
          slug: content.slug,
          title: publishedVersion?.title || content.slug,
          publishedAt: content.publishedAt || null,
        };
      });
    },

    listAllContent: async () => {
      const contents = await contentRepository.findAllContentSummaries();
      return contents.map((content) => {
        const publishedVersion = (content.versions || []).find(
          (version) => version.id.toString() === content.publishedVersionId?.toString(),
        );
        const currentVersion = (content.versions || []).find(
          (version) => version.id.toString() === content.currentVersionId?.toString(),
        );

        return {
          id: content._id.toString(),
          slug: content.slug,
          status: content.status,
          publishedAt: content.publishedAt || null,
          scheduledPublishAt: content.scheduledPublishAt || null,
          title: currentVersion?.title || publishedVersion?.title || content.slug,
          currentVersionId: content.currentVersionId ? content.currentVersionId.toString() : null,
          publishedVersionId: content.publishedVersionId ? content.publishedVersionId.toString() : null,
        };
      });
    },

    getPublicContentById: async ({ auth, contentId }) => {
      const content = await contentRepository.findPublishedContentById(contentId);
      if (!content) {
        if (auth && auth.roles && auth.roles.some((role) => ["administrator", "service_manager", "staff"].includes(role))) {
          const staffContent = await contentRepository.findContentById(contentId);
          if (!staffContent) {
            throw createError(404, "CONTENT_NOT_FOUND", "Content not found");
          }
          const staffPublishedVersion = (staffContent.versions || []).find(
            (version) => version.id.toString() === staffContent.publishedVersionId?.toString(),
          );
          return {
            id: staffContent._id.toString(),
            slug: staffContent.slug,
            status: staffContent.status,
            publishedVersionId: staffContent.publishedVersionId ? staffContent.publishedVersionId.toString() : null,
            currentVersionId: staffContent.currentVersionId ? staffContent.currentVersionId.toString() : null,
            title: staffPublishedVersion?.title || staffContent.slug,
            body: staffPublishedVersion?.body || "",
            versions: (staffContent.versions || []).map((version) => ({
              id: version.id.toString(),
              title: version.title,
              body: version.body,
              mediaIds: (version.mediaIds || []).map((id) => id.toString()),
              createdAt: version.createdAt,
            })),
          };
        }

        throw createError(404, "CONTENT_NOT_FOUND", "Content not found");
      }

      const publishedVersion = (content.versions || []).find(
        (version) => version.id.toString() === content.publishedVersionId?.toString(),
      );

      return {
        id: content._id.toString(),
        slug: content.slug,
        title: publishedVersion?.title || content.slug,
        body: publishedVersion?.body || "",
        publishedAt: content.publishedAt || null,
      };
    },

    createContent: async ({ body }) => {
      const { slug, title, body: contentBody, mediaIds } = body || {};
      if (!slug || typeof slug !== "string") {
        throw createError(400, "INVALID_SLUG", "slug is required");
      }

      const mediaParse = mediaIds === undefined ? { ok: true, parsed: [] } : parseObjectIdArray(mediaIds);
      if (!mediaParse.ok) {
        throw createError(400, "INVALID_MEDIA_ID", "mediaIds must be a valid id array");
      }

      const mediaRefs = await validateAndCollectMediaRefs({ contentBody, explicitMediaIds: mediaParse.parsed });
      const version = buildContentVersion({ title, body: contentBody, mediaIds: mediaParse.parsed, mediaRefs });
      try {
        const result = await contentRepository.insertContent({
          slug: slug.trim(),
          status: "draft",
          mediaRefs,
          versions: [version],
          currentVersionId: version.id,
          publishedVersionId: null,
          scheduledPublishAt: null,
          scheduledVersionId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await syncContentSearchDocument(result.insertedId);
        return { id: result.insertedId.toString(), versionId: version.id.toString() };
      } catch (error) {
        if (error && error.code === 11000) {
          throw createError(409, "SLUG_EXISTS", "Content slug already exists");
        }
        throw error;
      }
    },

    updateContentDraftById: async ({ auth, body, contentId, req }) => {
      const { title, body: contentBody, mediaIds } = body || {};
      const mediaParse = mediaIds === undefined ? { ok: true, parsed: [] } : parseObjectIdArray(mediaIds);
      if (!mediaParse.ok) {
        throw createError(400, "INVALID_MEDIA_ID", "mediaIds must be a valid id array");
      }

      const mediaRefs = await validateAndCollectMediaRefs({ contentBody, explicitMediaIds: mediaParse.parsed });
      const version = buildContentVersion({ title, body: contentBody, mediaIds: mediaParse.parsed, mediaRefs });
      const updated = await contentRepository.pushDraftVersion(contentId, version);
      if (!updated) {
        throw createError(404, "CONTENT_NOT_FOUND", "Content not found");
      }

      await syncContentSearchDocument(contentId);
      await writeAuditLog({
        username: auth?.username,
        userId: auth?.sub ? new ObjectId(auth.sub) : null,
        action: "content.draft.update",
        outcome: "success",
        req,
      });

      return { id: contentId.toString(), currentVersionId: version.id.toString() };
    },

    scheduleContentById: async ({ auth, body, contentId, req }) => {
      const { publishAt, versionId } = body || {};
      const publishAtDate = new Date(publishAt);
      if (Number.isNaN(publishAtDate.getTime())) {
        throw createError(400, "INVALID_PUBLISH_AT", "publishAt must be a valid ISO datetime");
      }

      const content = await findContentOrThrow(contentId);
      const scheduledVersionId = versionId ? parseObjectIdOrNull(versionId) : content.currentVersionId;
      if (!scheduledVersionId) {
        throw createError(400, "INVALID_VERSION_ID", "versionId is invalid");
      }
      assertVersionExists(content, scheduledVersionId);

      await contentRepository.updateSchedule(contentId, publishAtDate, scheduledVersionId);
      await syncContentSearchDocument(contentId);
      await writeAuditLog({
        username: auth?.username,
        userId: auth?.sub ? new ObjectId(auth.sub) : null,
        action: "content.schedule",
        outcome: "success",
        req,
      });

      return {
        id: contentId.toString(),
        scheduledPublishAt: publishAtDate,
        scheduledVersionId: scheduledVersionId.toString(),
      };
    },

    publishContentById: async ({ body, contentId }) => {
      const { versionId } = body || {};
      const content = await findContentOrThrow(contentId);

      const targetVersionId = versionId ? parseObjectIdOrNull(versionId) : content.currentVersionId;
      if (!targetVersionId) {
        throw createError(400, "INVALID_VERSION_ID", "versionId is invalid");
      }
      assertVersionExists(content, targetVersionId);
      const targetVersion = findVersionOrThrow(content, targetVersionId);
      const mediaRefs = await validateAndCollectMediaRefs({
        contentBody: targetVersion.body,
        explicitMediaIds: targetVersion.mediaIds || [],
      });

      await contentRepository.publishVersion(contentId, targetVersionId, mediaRefs);
      await syncContentSearchDocument(contentId);
      return { id: contentId.toString(), publishedVersionId: targetVersionId.toString() };
    },

    getContentVersionsById: async ({ contentId }) => {
      const content = await findContentOrThrow(contentId);
      return {
        id: contentId.toString(),
        slug: content.slug,
        status: content.status,
        currentVersionId: content.currentVersionId ? content.currentVersionId.toString() : null,
        publishedVersionId: content.publishedVersionId ? content.publishedVersionId.toString() : null,
        scheduledPublishAt: content.scheduledPublishAt || null,
        scheduledVersionId: content.scheduledVersionId ? content.scheduledVersionId.toString() : null,
        versions: (content.versions || []).map((version) => ({
          id: version.id.toString(),
          title: version.title,
          body: version.body,
          mediaIds: (version.mediaIds || []).map((id) => id.toString()),
          createdAt: version.createdAt,
        })),
      };
    },

    rollbackContentById: async ({ body, contentId }) => {
      const versionId = parseObjectIdOrNull(body?.versionId);
      if (!versionId) {
        throw createError(400, "INVALID_VERSION_ID", "versionId is required and must be valid");
      }

      const content = await findContentOrThrow(contentId);
      assertVersionExists(content, versionId);
      const targetVersion = findVersionOrThrow(content, versionId);
      const mediaRefs = await validateAndCollectMediaRefs({
        contentBody: targetVersion.body,
        explicitMediaIds: targetVersion.mediaIds || [],
      });

      await contentRepository.rollbackVersion(contentId, versionId, mediaRefs);
      await syncContentSearchDocument(contentId);
      return { id: contentId.toString(), publishedVersionId: versionId.toString() };
    },

    parseContentIdOrThrow: (id) => {
      const contentId = parseObjectIdOrNull(id);
      if (!contentId) {
        throw createError(400, "INVALID_CONTENT_ID", "Content id is invalid");
      }
      return contentId;
    },
  };
}

module.exports = {
  createContentService,
};
