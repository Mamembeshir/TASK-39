const express = require("express");

function createProfileRouter({ controller, requireAuth }) {
  const router = express.Router();

  router.put("/contact", requireAuth, controller.updateProfileContact);
  router.get("/me", requireAuth, controller.getProfileMe);

  return router;
}

function createFavoritesRouter({ controller, requireCustomer }) {
  const router = express.Router();

  router.post("/:serviceId", requireCustomer, controller.addFavoriteByServiceId);
  router.delete("/:serviceId", requireCustomer, controller.removeFavoriteByServiceId);
  router.get("/", requireCustomer, controller.listFavorites);

  return router;
}

function createCompareRouter({ controller, requireCustomer }) {
  const router = express.Router();

  router.put("/", requireCustomer, controller.setCompareList);
  router.get("/", requireCustomer, controller.getCompareList);

  return router;
}

function createQuoteRouter({ controller, requireCustomer }) {
  const router = express.Router();

  router.get('/jurisdictions', requireCustomer, controller.listQuoteJurisdictions);
  router.get('/slots', requireCustomer, controller.listQuoteSlots);
  router.post("/", requireCustomer, controller.createQuote);

  return router;
}

module.exports = {
  createCompareRouter,
  createFavoritesRouter,
  createProfileRouter,
  createQuoteRouter,
};
