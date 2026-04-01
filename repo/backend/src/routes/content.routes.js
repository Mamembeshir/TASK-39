const express = require("express");

function createContentRouter({ controller, requireStaff, attachOptionalAuth }) {
  const router = express.Router();

  router.get("/manage", requireStaff, controller.listAllContent);
  router.get("/", attachOptionalAuth, controller.listPublishedContent);
  router.get("/:id", attachOptionalAuth, controller.getContentByIdPublic);
  router.post("/", requireStaff, controller.createContent);
  router.patch("/:id/draft", requireStaff, controller.updateContentDraftById);
  router.post("/:id/schedule", requireStaff, controller.scheduleContentById);
  router.post("/:id/publish", requireStaff, controller.publishContentById);
  router.get("/:id/versions", requireStaff, controller.getContentVersionsById);
  router.post("/:id/rollback", requireStaff, controller.rollbackContentById);

  return router;
}

module.exports = {
  createContentRouter,
};
