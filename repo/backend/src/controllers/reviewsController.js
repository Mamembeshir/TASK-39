function createReviewsController(deps) {
  const { createError, parseObjectIdOrNull, reviewsService } = deps;

  return {
    createReview: async (req, res, next) => {
      try {
        const result = await reviewsService.createReview({ auth: req.auth, body: req.body });
        return res.status(201).json(result);
      } catch (error) {
        return next(error);
      }
    },

    approveReviewById: async (req, res, next) => {
      try {
        const reviewId = parseObjectIdOrNull(req.params.id);
        if (!reviewId) {
          return next(createError(400, "INVALID_REVIEW_ID", "Review id is invalid"));
        }

        const result = await reviewsService.approveReviewById({ auth: req.auth, req, reviewId });
        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },

    rejectReviewById: async (req, res, next) => {
      try {
        const reviewId = parseObjectIdOrNull(req.params.id);
        if (!reviewId) {
          return next(createError(400, "INVALID_REVIEW_ID", "Review id is invalid"));
        }

        const result = await reviewsService.rejectReviewById({ auth: req.auth, req, reviewId });
        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },

    listModerationQueue: async (req, res, next) => {
      try {
        const result = await reviewsService.listModerationQueue({ auth: req.auth });
        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },
  };
}

module.exports = {
  createReviewsController,
};
