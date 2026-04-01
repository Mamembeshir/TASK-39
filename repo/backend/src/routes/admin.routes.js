const express = require("express");

function createAdminRouter({ controller, requireAdministrator }) {
  const router = express.Router();
  router.get('/audit', requireAdministrator, controller.listAuditLogs);
  router.get('/blacklist', requireAdministrator, controller.listBlacklist);
  router.post('/blacklist', requireAdministrator, controller.upsertBlacklist);
  return router;
}

module.exports = {
  createAdminRouter,
};
