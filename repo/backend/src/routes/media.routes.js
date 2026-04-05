const express = require("express");

function createMediaRouter({ controller, requireAuth, upload, maxReviewImages }) {
  const router = express.Router();

  router.post("/", requireAuth, upload.array("files", maxReviewImages), controller.uploadMedia);
  router.get("/files/:id", requireAuth, controller.getMediaFileById);
  router.delete("/:id", requireAuth, controller.deleteMediaById);

  return router;
}

module.exports = {
  createMediaRouter,
};
