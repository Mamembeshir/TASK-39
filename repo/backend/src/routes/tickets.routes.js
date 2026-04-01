const express = require("express");

function createTicketsRouter({ controller, requireAuth, requireStaff }) {
  const router = express.Router();

  router.post("/", requireAuth, controller.createTicket);
  router.get("/", requireAuth, controller.listTickets);
  router.get("/:id", requireAuth, controller.getTicketById);
  router.post("/:id/status", requireAuth, controller.updateTicketStatus);
  router.post("/:id/legal-hold", requireStaff, controller.setTicketLegalHold);
  router.post("/:id/resolve", requireStaff, controller.resolveTicket);

  return router;
}

module.exports = {
  createTicketsRouter,
};
