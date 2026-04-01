const test = require("node:test");
const assert = require("node:assert/strict");

const { createReviewsService } = require("./reviewsService");

function createError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

const baseDeps = {
  ALLOWED_MEDIA_MIME: { 'image/png': 'png' },
  assertCanSubmitReviewForOrder: () => {},
  containsSensitiveTerms: () => false,
  createError,
  MAX_REVIEW_IMAGES: 6,
  MAX_UPLOAD_BYTES: 10 * 1024 * 1024,
  ObjectId: function ObjectId(value) { this.value = value; this.toString = () => String(value); },
  parseObjectIdOrNull: (value) => (value ? { toString: () => String(value) } : null),
  REVIEW_TAG_IDS: ['kind', 'thorough'],
  toOrgTimezoneDate: (date) => new Date(date),
  writeAuditLog: async () => {},
};

test("createReview quarantines sensitive text", async () => {
  const service = createReviewsService({
    ...baseDeps,
    containsSensitiveTerms: () => true,
    reviewsRepository: {
      findSettings: async () => ({ organizationTimezone: 'America/Los_Angeles', sensitiveTerms: ['bad'] }),
      findOrderById: async () => ({ state: 'completed', completedAt: new Date(), customerId: { toString: () => 'u1' }, lineItems: [] }),
      findMediaByIds: async () => [],
      findBundlesByIds: async () => [],
      insertReview: async () => ({ insertedId: { toString: () => 'rev-1' } }),
    },
  });

  const result = await service.createReview({
    auth: { sub: 'u1' },
    body: { orderId: 'ord-1', rating: 5, tags: ['kind'], text: 'bad text', mediaIds: [] },
  });

  assert.deepEqual(result, { id: 'rev-1', status: 'quarantined' });
});

test("createReview rejects expired review windows", async () => {
  const service = createReviewsService({
    ...baseDeps,
    reviewsRepository: {
      findSettings: async () => ({ organizationTimezone: 'America/Los_Angeles', sensitiveTerms: [] }),
      findOrderById: async () => ({
        state: 'completed',
        completedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        customerId: { toString: () => 'u1' },
        lineItems: [],
      }),
      findMediaByIds: async () => [],
      findBundlesByIds: async () => [],
    },
  });

  await assert.rejects(
    () => service.createReview({
      auth: { sub: 'u1' },
      body: { orderId: 'ord-1', rating: 5, tags: ['kind'], text: 'okay', mediaIds: [] },
    }),
    (error) => error && error.code === 'REVIEW_WINDOW_EXPIRED',
  );
});
