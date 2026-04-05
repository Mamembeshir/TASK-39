function createMediaController(deps) {
  const { createError, mediaService, parseObjectIdOrNull } = deps;

  return {
    uploadMedia: async (req, res, next) => {
      try {
        let crop = null;
        if (typeof req.body?.crop === "string" && req.body.crop.trim().length > 0) {
          try {
            crop = JSON.parse(req.body.crop);
          } catch (error) {
            return next(createError(400, "INVALID_CROP", "crop must be valid JSON"));
          }
        }

        const result = await mediaService.uploadMedia({
          auth: req.auth,
          crop,
          files: req.files || [],
          purpose: req.body?.purpose,
        });
        return res.status(201).json(result);
      } catch (error) {
        return next(error);
      }
    },

    getMediaFileById: async (req, res, next) => {
      try {
        const mediaId = parseObjectIdOrNull(req.params.id);
        if (!mediaId) {
          return next(createError(400, "INVALID_MEDIA_ID", "Media id is invalid"));
        }

        const mediaFile = await mediaService.getMediaFileById({ auth: req.auth, mediaId });
        res.setHeader("Content-Type", mediaFile.mime);
        return res.sendFile(mediaFile.filePath);
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

        const result = await mediaService.deleteMediaById({ auth: req.auth, mediaId });
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
