const express = require("express");

function createTicketsRouter({ controller, requireAuth, requireDisputeStaff }) {
  const router = express.Router();

  router.post("/", requireAuth, controller.createTicket);
  router.get("/", requireAuth, controller.listTickets);
  router.get("/:id", requireAuth, controller.getTicketById);
  router.post("/:id/status", requireAuth, controller.updateTicketStatus);
  router.post("/:id/legal-hold", requireDisputeStaff, controller.setTicketLegalHold);
  router.post("/:id/resolve", requireDisputeStaff, controller.resolveTicket);

  return router;
}

module.exports = {
  createTicketsRouter,
};
