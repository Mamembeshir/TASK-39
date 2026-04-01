function createMediaController(deps) {
  const { createError, mediaService, parseObjectIdOrNull } = deps;

  return {
    uploadMedia: async (req, res, next) => {
      try {
        const result = await mediaService.uploadMedia({
          auth: req.auth,
          files: req.files || [],
          purpose: req.body?.purpose,
        });
        return res.status(201).json(result);
      } catch (error) {
        return next(error);
      }
    },

    deleteMediaById: async (req, res, next) => {
      try {
        const mediaId = parseObjectIdOrNull(req.params.id);
        if (!mediaId) {
          return next(createError(400, "INVALID_MEDIA_ID", "Media id is invalid"));
        }

        const result = await mediaService.deleteMediaById({ mediaId });
        return res.status(result.status).json(result.body);
      } catch (error) {
        return next(error);
      }
    },
  };
}

module.exports = {
  createMediaController,
};
