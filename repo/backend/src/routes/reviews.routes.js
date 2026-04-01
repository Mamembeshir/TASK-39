const express = require("express");

function createReviewsRouter({ controller, requireCustomer, requireModerator }) {
  const router = express.Router();

  router.post("/", requireCustomer, controller.createReview);

  const moderationRouter = express.Router();
  moderationRouter.get("/reviews", requireModerator, controller.listModerationQueue);
  moderationRouter.post("/reviews/:id/approve", requireModerator, controller.approveReviewById);
  moderationRouter.post("/reviews/:id/reject", requireModerator, controller.rejectReviewById);

  return { router, moderationRouter };
}

module.exports = {
  createReviewsRouter,
};
