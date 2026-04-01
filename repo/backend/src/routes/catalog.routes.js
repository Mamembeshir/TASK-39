const express = require("express");

function createCatalogRouter({ controller, requireCustomer, requireModeration }) {
  const router = express.Router();

  router.get("/services", controller.listServices);
  router.get("/search", controller.search);
  router.get("/services/:id", controller.getServiceById);
  router.get("/services/:id/questions", controller.listServiceQuestions);
  router.post("/services/:id/questions", requireCustomer, controller.createServiceQuestion);
  router.get("/services/:id/reviews", controller.listServiceReviews);
  router.get("/moderation/questions", requireModeration, controller.listPendingServiceQuestions);
  router.post("/moderation/questions/:id/publish", requireModeration, controller.publishServiceQuestionById);
  router.post("/moderation/questions/:id/reject", requireModeration, controller.rejectServiceQuestionById);

  return router;
}

function createStaffCatalogRouter({ controller, requireStaff }) {
  const router = express.Router();

  router.post("/services", requireStaff, controller.createService);
  router.patch("/services/:id", requireStaff, controller.updateServiceById);
  router.post("/services/:id/publish", requireStaff, controller.publishServiceById);
  router.post("/services/:id/unpublish", requireStaff, controller.unpublishServiceById);

  router.post("/bundles", requireStaff, controller.createBundle);
  router.patch("/bundles/:id", requireStaff, controller.updateBundleById);
  router.post("/bundles/:id/publish", requireStaff, controller.publishBundleById);
  router.post("/bundles/:id/unpublish", requireStaff, controller.unpublishBundleById);

  return router;
}

module.exports = {
  createCatalogRouter,
  createStaffCatalogRouter,
};
