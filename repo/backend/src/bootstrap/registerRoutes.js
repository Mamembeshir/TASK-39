const { createAuthController } = require("../controllers/authController");
const { createAdminController } = require("../controllers/adminController");
const { createCatalogController } = require("../controllers/catalogController");
const { createContentController } = require("../controllers/contentController");
const { createCustomerController } = require("../controllers/customerController");
const { createInboxController } = require("../controllers/inboxController");
const { createInternalController } = require("../controllers/internalController");
const { createMediaController } = require("../controllers/mediaController");
const { createOrdersController } = require("../controllers/ordersController");
const { createReviewsController } = require("../controllers/reviewsController");
const { createTicketsController } = require("../controllers/ticketsController");
const { createAuthRouter } = require("../routes/auth.routes");
const { createAdminRouter } = require("../routes/admin.routes");
const { createCatalogRouter, createStaffCatalogRouter } = require("../routes/catalog.routes");
const { createContentRouter } = require("../routes/content.routes");
const { createCompareRouter, createFavoritesRouter, createProfileRouter, createQuoteRouter } = require("../routes/customer.routes");
const { createInboxRouter, createStaffMessagesRouter } = require("../routes/inbox.routes");
const { createInternalRouter } = require("../routes/internal.routes");
const { createMediaRouter } = require("../routes/media.routes");
const { createOrdersRouter, createStaffOrdersRouter } = require("../routes/orders.routes");
const { createReviewsRouter } = require("../routes/reviews.routes");
const { createTicketsRouter } = require("../routes/tickets.routes");

function registerRoutes(deps) {
  const {
    app,
    assessLoginRisk,
    attachOptionalAuth,
    authSchemas,
    authService,
    buildQuoteFromRequestPayload,
    catalogService,
    contentService,
    createError,
    createQuoteSignature,
    decryptField,
    encryptField,
    getDatabase,
    getDeviceFingerprint,
    hasRole,
    inboxService,
    maskAddress,
    maskPhone,
    MAX_REVIEW_IMAGES,
    mediaService,
    MESSAGE_CREATOR_ROLES,
    MODERATOR_ROLES,
    ObjectId,
    ordersService,
    parseObjectIdOrNull,
    requireAdministrator,
    requireAuth,
    requireCustomer,
    requireModeration,
    requireRoles,
    reviewsService,
    STAFF_ROLES,
    ticketsService,
    upload,
    validate,
    writeAuditLog,
  } = deps;

  const authController = createAuthController({
    authService,
    createError,
    getDatabase,
    getDeviceFingerprint,
    writeAuditLog,
    assessLoginRisk,
    ObjectId,
  });

  app.use(
    "/api/auth",
    createAuthRouter({
      controller: authController,
      validate,
      requireAuth,
      authSchemas,
    }),
  );

  const customerController = createCustomerController({
    buildQuoteFromRequestPayload,
    createError,
    createQuoteSignature,
    decryptField,
    encryptField,
    getDatabase,
    hasRole,
    maskAddress,
    maskPhone,
    ObjectId,
    parseObjectIdOrNull,
    STAFF_ROLES,
  });

  app.use(
    "/api/profile",
    createProfileRouter({
      controller: customerController,
      requireAuth,
    }),
  );

  app.use(
    "/api/favorites",
    createFavoritesRouter({
      controller: customerController,
      requireCustomer,
    }),
  );

  app.use(
    "/api/compare",
    createCompareRouter({
      controller: customerController,
      requireCustomer,
    }),
  );

  app.use(
    "/api/quote",
    createQuoteRouter({
      controller: customerController,
      requireCustomer,
    }),
  );

  const ordersController = createOrdersController({
    createError,
    decryptField,
    hasRole,
    maskAddress,
    maskPhone,
    ObjectId,
    ordersService,
    parseObjectIdOrNull,
    STAFF_ROLES,
    writeAuditLog,
  });

  const adminController = createAdminController({
    createError,
    getDatabase,
    ObjectId,
    writeAuditLog,
  });

  app.use(
    "/api/orders",
    createOrdersRouter({
      controller: ordersController,
      requireAuth,
      requireCustomer,
    }),
  );

  app.use(
    "/api/staff/orders",
    createStaffOrdersRouter({
      controller: ordersController,
      requireStaff: requireRoles(STAFF_ROLES),
    }),
  );

  app.use(
    "/api/admin",
    createAdminRouter({
      controller: adminController,
      requireAdministrator,
    }),
  );

  const catalogController = createCatalogController({
    catalogService,
    ObjectId,
  });

  app.use(
    "/api",
    createCatalogRouter({
      controller: catalogController,
      requireCustomer,
      requireModeration,
    }),
  );

  const contentController = createContentController({
    contentService,
  });

  app.use(
    "/api/content",
    createContentRouter({
      controller: contentController,
      attachOptionalAuth,
      requireStaff: requireRoles(STAFF_ROLES),
    }),
  );

  const mediaController = createMediaController({
    createError,
    mediaService,
    parseObjectIdOrNull,
  });

  app.use(
    "/api/media",
    createMediaRouter({
      controller: mediaController,
      requireAuth,
      upload,
      maxReviewImages: MAX_REVIEW_IMAGES,
    }),
  );

  const reviewsController = createReviewsController({
    createError,
    parseObjectIdOrNull,
    reviewsService,
  });

  const { router: reviewsRouter, moderationRouter } = createReviewsRouter({
    controller: reviewsController,
    requireCustomer,
    requireModerator: requireRoles(MODERATOR_ROLES),
  });

  app.use("/api/reviews", reviewsRouter);
  app.use("/api/moderation", moderationRouter);

  const ticketsController = createTicketsController({
    createError,
    ObjectId,
    parseObjectIdOrNull,
    ticketsService,
    writeAuditLog,
  });

  app.use(
    "/api/tickets",
    createTicketsRouter({
      controller: ticketsController,
      requireAuth,
      requireDisputeStaff: requireRoles([...STAFF_ROLES, "moderator"]),
    }),
  );

  const inboxController = createInboxController({
    createError,
    inboxService,
    ObjectId,
    parseObjectIdOrNull,
  });

  app.use(
    "/api/staff/messages",
    createStaffMessagesRouter({
      controller: inboxController,
      requireMessageCreator: requireRoles(MESSAGE_CREATOR_ROLES),
    }),
  );

  app.use(
    "/api/inbox",
    createInboxRouter({
      controller: inboxController,
      requireAuth,
    }),
  );

  app.use(
    "/api/staff",
    createStaffCatalogRouter({
      controller: catalogController,
      requireStaff: requireRoles(STAFF_ROLES),
    }),
  );

  if (process.env.INTERNAL_ROUTES_ENABLED === "true") {
    if (process.env.NODE_ENV !== "test") {
      throw new Error(
        `INTERNAL_ROUTES_ENABLED=true is only allowed when NODE_ENV=test (got NODE_ENV=${process.env.NODE_ENV || "<unset>"})`,
      );
    }

    const internalRoutesToken = process.env.INTERNAL_ROUTES_TOKEN;
    if (!internalRoutesToken || internalRoutesToken.length < 16) {
      throw new Error(
        "INTERNAL_ROUTES_ENABLED=true requires INTERNAL_ROUTES_TOKEN of at least 16 characters",
      );
    }

    // eslint-disable-next-line no-console
    console.warn(
      "[security] internal fixture routes mounted at /api/internal (NODE_ENV=test only)",
    );

    const requireInternalToken = (req, res, next) => {
      const provided = req.headers["x-internal-token"];
      if (typeof provided !== "string" || provided !== internalRoutesToken) {
        return next(createError(403, "FORBIDDEN", "Internal route token required"));
      }
      return next();
    };

    const internalController = createInternalController({
      createError,
      getDatabase,
      ObjectId,
      writeAuditLog,
    });

    app.use(
      "/api/internal",
      createInternalRouter({
        controller: internalController,
        requireAuth,
        requireAdministrator,
        requireInternalToken,
      }),
    );
  }
}

module.exports = {
  registerRoutes,
};
