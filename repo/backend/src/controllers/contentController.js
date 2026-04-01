function createContentController(deps) {
  const { contentService } = deps;

  return {
    listAllContent: async (req, res, next) => {
      try {
        const result = await contentService.listAllContent();
        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },

    listPublishedContent: async (req, res, next) => {
      try {
        const result = await contentService.listPublishedContent();
        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },

    getContentByIdPublic: async (req, res, next) => {
      try {
        const contentId = contentService.parseContentIdOrThrow(req.params.id);
        const result = await contentService.getPublicContentById({ auth: req.auth, contentId });
        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },

    createContent: async (req, res, next) => {
      try {
        const result = await contentService.createContent({ body: req.body });
        return res.status(201).json(result);
      } catch (error) {
        return next(error);
      }
    },

    updateContentDraftById: async (req, res, next) => {
      try {
        const contentId = contentService.parseContentIdOrThrow(req.params.id);
        const result = await contentService.updateContentDraftById({
          auth: req.auth,
          body: req.body,
          contentId,
          req,
        });
        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },

    scheduleContentById: async (req, res, next) => {
      try {
        const contentId = contentService.parseContentIdOrThrow(req.params.id);
        const result = await contentService.scheduleContentById({
          auth: req.auth,
          body: req.body,
          contentId,
          req,
        });
        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },

    publishContentById: async (req, res, next) => {
      try {
        const contentId = contentService.parseContentIdOrThrow(req.params.id);
        const result = await contentService.publishContentById({
          body: req.body,
          contentId,
        });
        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },

    getContentVersionsById: async (req, res, next) => {
      try {
        const contentId = contentService.parseContentIdOrThrow(req.params.id);
        const result = await contentService.getContentVersionsById({ contentId });
        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },

    rollbackContentById: async (req, res, next) => {
      try {
        const contentId = contentService.parseContentIdOrThrow(req.params.id);
        const result = await contentService.rollbackContentById({
          body: req.body,
          contentId,
        });
        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },
  };
}

module.exports = {
  createContentController,
};
