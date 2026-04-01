const express = require("express");

function createAuthRouter({ controller, validate, requireAuth, authSchemas }) {
  const router = express.Router();

  router.post("/register", validate({ body: authSchemas.authRegisterBodySchema }), controller.register);
  router.post("/login", validate({ body: authSchemas.authLoginBodySchema }), controller.login);
  router.post("/refresh", controller.refresh);
  router.post("/logout", controller.logout);
  router.get("/me", requireAuth, controller.me);

  return router;
}

module.exports = {
  createAuthRouter,
};
