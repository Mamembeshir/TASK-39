const express = require("express");

function createInboxRouter({ controller, requireAuth }) {
  const router = express.Router();

  router.get("/", requireAuth, controller.listInbox);
  router.post("/:id/read", requireAuth, controller.markInboxRead);

  return router;
}

function createStaffMessagesRouter({ controller, requireMessageCreator }) {
  const router = express.Router();

  router.post("/", requireMessageCreator, controller.createStaffMessage);

  return router;
}

module.exports = {
  createInboxRouter,
  createStaffMessagesRouter,
};
