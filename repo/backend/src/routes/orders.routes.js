const express = require("express");

function createOrdersRouter({ controller, requireAuth, requireCustomer }) {
  const router = express.Router();

  router.post("/", requireCustomer, controller.createOrder);
  router.get("/", requireCustomer, controller.listOrders);
  router.get("/:id", requireAuth, controller.getOrderById);
  router.post("/:id/cancel", requireAuth, controller.cancelOrderById);

  return router;
}

function createStaffOrdersRouter({ controller, requireStaff }) {
  const router = express.Router();
  router.get("/slots", requireStaff, controller.listCapacitySlots);
  router.post("/slots", requireStaff, controller.createCapacitySlot);
  router.post("/slots/:id", requireStaff, controller.updateCapacitySlot);
  router.delete("/slots/:id", requireStaff, controller.deleteCapacitySlot);
  router.post("/:id/complete", requireStaff, controller.completeOrderById);
  return router;
}

module.exports = {
  createOrdersRouter,
  createStaffOrdersRouter,
};
