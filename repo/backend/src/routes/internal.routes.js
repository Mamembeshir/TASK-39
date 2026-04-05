const express = require("express");

function createInternalRouter({ controller, requireAuth, requireAdministrator, requireInternalToken }) {
  const router = express.Router();
  const guards = [requireAuth, requireAdministrator, requireInternalToken].filter(
    (middleware) => typeof middleware === "function",
  );

  router.get("/seed-check", ...guards, controller.seedCheck);
  router.post("/test-fixtures/booking-slot", ...guards, controller.createBookingSlotFixture);
  router.post("/test-fixtures/completed-order", ...guards, controller.createCompletedOrderFixture);
  router.post("/test-fixtures/blacklist-ip", ...guards, controller.blacklistIpFixture);
  router.post("/constraints/users-username", ...guards, controller.checkUsersUsernameConstraint);

  return router;
}

module.exports = {
  createInternalRouter,
};
