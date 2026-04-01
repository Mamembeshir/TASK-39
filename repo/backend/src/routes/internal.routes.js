const express = require("express");

function createInternalRouter({ controller }) {
  const router = express.Router();

  router.get("/seed-check", controller.seedCheck);
  router.post("/test-fixtures/booking-slot", controller.createBookingSlotFixture);
  router.post("/test-fixtures/completed-order", controller.createCompletedOrderFixture);
  router.post("/test-fixtures/blacklist-ip", controller.blacklistIpFixture);
  router.post("/constraints/users-username", controller.checkUsersUsernameConstraint);

  return router;
}

module.exports = {
  createInternalRouter,
};
