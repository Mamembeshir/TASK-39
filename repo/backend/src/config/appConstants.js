const VALID_DURATIONS = [30, 60, 90];
const VALID_TOOLS_MODE = ["provider", "customer"];
const STAFF_ROLES = ["administrator", "service_manager"];
const CUSTOMER_ROLES = ["customer"];
const MODERATOR_ROLES = ["moderator", "administrator"];
const MESSAGE_CREATOR_ROLES = ["administrator", "service_manager", "moderator"];
const REVIEW_TAG_IDS = ["quality", "punctual", "communication", "value", "professionalism"];
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_REVIEW_IMAGES = 6;
const SLA_FIRST_RESPONSE_MINUTES = 8 * 60;
const SLA_RESOLUTION_MINUTES = 5 * 8 * 60;

const ALLOWED_MEDIA_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

module.exports = {
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
};
