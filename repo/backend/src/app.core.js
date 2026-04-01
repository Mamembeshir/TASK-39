/*
 * Behavior-freeze compatibility module.
 *
 * This file intentionally remains large during R2 to preserve route behavior
 * while bootstrap and module boundaries are being introduced incrementally.
 *
 * Follow-up refactor prompts will continue slicing this into dedicated
 * routes/controllers/services/repositories without changing HTTP contracts.
 */

const express = require("express");
const fs = require("fs/promises");
const cors = require("cors");
const helmet = require("helmet");
const multer = require("multer");
const cookieParser = require("cookie-parser");
const { ObjectId } = require("mongodb");
const { connectWithRetry, getDatabase } = require("./db");
const authService = require("./services/auth/authService");
const { getDeviceFingerprint } = require("./services/auth/deviceFingerprintService");
const { createAuditService } = require("./services/audit/auditService");
const { createCatalogPayloadService } = require("./services/catalog/catalogPayloadService");
const { createCatalogService } = require("./services/catalog/catalogService");
const { extractContentMediaRefs } = require("./services/content/contentMediaExtractor");
const { createContentService } = require("./services/content/contentService");
const { buildInboxVisibilityFilter } = require("./services/inbox/inboxVisibilityService");
const { createInboxService } = require("./services/inbox/inboxService");
const { createMediaService } = require("./services/media/mediaService");
const {
  detectMimeFromMagicBytes,
  createMediaProcessingService,
} = require("./services/media/mediaProcessingService");
const { containsSensitiveTerms } = require("./services/moderation/sensitiveTermsService");
const { createSlotService } = require("./services/orders/slotService");
const { createOrdersService } = require("./services/orders/ordersService");
const { createQuoteService, createQuoteSignature } = require("./services/quote/quoteService");
const { createSearchSyncService } = require("./services/search/searchSyncService");
const { createTicketsService } = require("./services/tickets/ticketsService");
const { createReviewsService } = require("./services/reviews/reviewsService");
const { registerRoutes } = require("./bootstrap/registerRoutes");
const authSchemas = require("./validators/authSchemas");
const {
  assertCanAccessOrder,
  assertCanAccessTicket,
  assertCanSubmitReviewForOrder,
} = require("./services/authorization/ownershipService");
const {
  attachOptionalAuth,
  getClientIp,
  hasRole,
  rateLimitMiddleware,
  requireAuth,
  requireCsrf,
  requireRole,
} = require("./middleware/authenticate");
const { createRouteAuthorizer } = require("./middleware/authorizeRoute");
const { createEnforceBlacklist } = require("./middleware/enforceBlacklist");
const { routePolicies } = require("./config/routePolicies");
const {
  ALLOWED_MEDIA_MIME,
  CUSTOMER_ROLES,
  MAX_REVIEW_IMAGES,
  MAX_UPLOAD_BYTES,
  MESSAGE_CREATOR_ROLES,
  MODERATOR_ROLES,
  REVIEW_TAG_IDS,
  SLA_FIRST_RESPONSE_MINUTES,
  SLA_RESOLUTION_MINUTES,
  STAFF_ROLES,
  VALID_DURATIONS,
  VALID_TOOLS_MODE,
} = require("./config/appConstants");
const { errorHandler } = require("./middleware/errorHandler");
const { validate, validateRequestShape } = require("./middleware/validate");
const { createAppError } = require("./errors/appError");
const { requestLogger } = require("./utils/logger");
const { createNetworkServer } = require("./utils/tlsServer");
const { startSearchCleanupScheduler } = require("./workers/searchCleanupScheduler");
const {
  buildContentVersion,
  parseObjectIdArray,
  parseObjectIdOrNull: parseObjectIdOrNullHelper,
  parseTagsQuery,
  toOrgTimezoneDate,
} = require("./utils/appCoreHelpers");
const { calculateQuote } = require("./pricing");
const { decryptField, encryptField, maskAddress, maskPhone } = require("./security");
const { computeSlaDeadlines } = require("./sla");
const ordersRepository = require("./repositories/ordersRepository");
const ticketsRepository = require("./repositories/ticketsRepository");
const messagesRepository = require("./repositories/messagesRepository");
const catalogRepository = require("./repositories/catalogRepository");
const contentRepository = require("./repositories/contentRepository");
const mediaRepository = require("./repositories/mediaRepository");
const reviewsRepository = require("./repositories/reviewsRepository");

const MEDIA_UPLOAD_DIR = process.env.MEDIA_UPLOAD_DIR || "/data/uploads";
const MEDIA_ENABLE_PROCESSING = process.env.MEDIA_ENABLE_PROCESSING === "true";

const app = express();
const port = Number(process.env.PORT) || 4000;
const corsAllowlist = (process.env.CORS_ALLOWLIST || "http://localhost:4000,https://localhost:4443")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: MAX_REVIEW_IMAGES,
  },
});

app.use(express.json());
app.use(cookieParser());
app.use(requestLogger);
app.use(helmet());
app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || corsAllowlist.includes(origin)) {
        return callback(null, true);
      }
      return callback(createError(403, "CORS_DENIED", "Origin not allowed"));
    },
  }),
);
app.use(validateRequestShape);
app.use(requireCsrf);
app.use("/media/files", express.static(MEDIA_UPLOAD_DIR, { index: false, fallthrough: false }));

function createError(status, code, message) {
  return createAppError(code, status, message);
}

function requireRoles(allowedRoles) {
  return requireRole(...allowedRoles);
}

const requireCustomer = requireRoles(CUSTOMER_ROLES);
const requireModeration = requireRoles(MODERATOR_ROLES);
const requireAdministrator = requireRoles(["administrator"]);

function parseObjectIdOrNull(value) {
  return parseObjectIdOrNullHelper(ObjectId, value);
}

function parseObjectIds(values) {
  return parseObjectIdArray(values, parseObjectIdOrNull);
}

function makeContentVersion(input) {
  return buildContentVersion(ObjectId, input);
}

const { writeAuditLog, assessLoginRisk } = createAuditService({
  getClientIp,
  getDatabase,
});

authService.configureRateLimitStore({ getDatabase });

const enforceBlacklist = createEnforceBlacklist({
  createError,
  getClientIp,
  getDatabase,
});

const { syncContentSearchDocument, syncServiceSearchDocument } = createSearchSyncService({ getDatabase });

const { normalizeBundlePayload, normalizeServicePayload } = createCatalogPayloadService({
  parseObjectIdOrNull,
  validDurations: VALID_DURATIONS,
  validToolsMode: VALID_TOOLS_MODE,
});

const { maybeCompressImage } = createMediaProcessingService({
  mediaEnableProcessing: MEDIA_ENABLE_PROCESSING,
});

const { buildQuoteFromRequestPayload } = createQuoteService({
  calculateQuote,
  createError,
  getDatabase,
  parseObjectIdOrNull,
});

const { findAlternativeSlots, releaseSlotCapacity, startPendingOrderReleaseWorker } = createSlotService({
  getDatabase,
});

const ordersService = createOrdersService({
  assertCanAccessOrder,
  buildQuoteFromRequestPayload,
  createError,
  createQuoteSignature,
  findAlternativeSlots,
  ordersRepository,
  releaseSlotCapacity,
});

const ticketsService = createTicketsService({
  assertCanAccessOrder,
  assertCanAccessTicket,
  computeSlaDeadlines,
  createError,
  SLA_FIRST_RESPONSE_MINUTES,
  SLA_RESOLUTION_MINUTES,
  ticketsRepository,
});

const inboxService = createInboxService({
  buildInboxVisibilityFilter,
  createError,
  messagesRepository,
});

const catalogService = createCatalogService({
  catalogRepository,
  createError,
  hasRole,
  normalizeBundlePayload,
  normalizeServicePayload,
  ObjectId,
  parseObjectIdOrNull,
  parseTagsQuery,
  STAFF_ROLES,
  syncServiceSearchDocument,
  writeAuditLog,
});

const contentService = createContentService({
  buildContentVersion: makeContentVersion,
  contentRepository,
  createError,
  extractContentMediaRefs,
  mediaRepository,
  ObjectId,
  parseObjectIdArray: parseObjectIds,
  parseObjectIdOrNull,
  syncContentSearchDocument,
  writeAuditLog,
});

const mediaService = createMediaService({
  ALLOWED_MEDIA_MIME,
  createError,
  detectMimeFromMagicBytes,
  fs,
  MAX_UPLOAD_BYTES,
  mediaRepository,
  MEDIA_ENABLE_PROCESSING,
  MEDIA_UPLOAD_DIR,
  maybeCompressImage,
  ObjectId,
});

const reviewsService = createReviewsService({
  ALLOWED_MEDIA_MIME,
  assertCanSubmitReviewForOrder,
  containsSensitiveTerms,
  createError,
  MAX_REVIEW_IMAGES,
  MAX_UPLOAD_BYTES,
  ObjectId,
  parseObjectIdOrNull,
  REVIEW_TAG_IDS,
  reviewsRepository,
  toOrgTimezoneDate,
  writeAuditLog,
});

app.use(attachOptionalAuth);
app.use(createRouteAuthorizer(routePolicies, requireAuth, requireRole));
app.use(enforceBlacklist);
app.use(rateLimitMiddleware);

app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

registerRoutes({
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
});

app.use((req, res, next) => {
  const error = new Error("Route not found");
  error.code = "NOT_FOUND";
  error.status = 404;
  next(error);
});

app.use(errorHandler);

async function startServer() {
  await connectWithRetry();
  startPendingOrderReleaseWorker();
  startSearchCleanupScheduler();
  const { protocol } = await createNetworkServer({
    app,
    fs,
    env: process.env,
    port,
  });
  console.log(`API listening on ${protocol.toUpperCase()} port ${port}`);
}

function createExpressApp() {
  return app;
}

module.exports = {
  createExpressApp,
  startServer,
};
