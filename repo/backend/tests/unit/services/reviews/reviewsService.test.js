const test = require("node:test");
const assert = require("node:assert/strict");

const { createReviewsService } = require("../../../../src/services/reviews/reviewsService");

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

test("createReview rejects media not owned by requester", async () => {
  const service = createReviewsService({
    ...baseDeps,
    reviewsRepository: {
      findSettings: async () => ({ organizationTimezone: 'America/Los_Angeles', sensitiveTerms: [] }),
      findOrderById: async () => ({
        state: 'completed',
        completedAt: new Date(),
        customerId: { toString: () => 'u1' },
        lineItems: [],
      }),
      findMediaByIds: async () => [
        { _id: 'm1', purpose: 'review', mime: 'image/png', byteSize: 128, createdBy: { toString: () => 'u2' } },
      ],
      findBundlesByIds: async () => [],
      insertReview: async () => {
        throw new Error('should not insert review');
      },
    },
  });

  await assert.rejects(
    () => service.createReview({
      auth: { sub: 'u1' },
      body: { orderId: 'ord-1', rating: 5, tags: ['kind'], text: 'okay', mediaIds: ['m1'] },
    }),
    (error) => error && error.code === 'MEDIA_FORBIDDEN' && error.status === 403,
  );
});

// ---- Additional coverage tests ----

test("createReview rejects invalid orderId", async () => {
  const service = createReviewsService({
    ...baseDeps,
    parseObjectIdOrNull: () => null,
    reviewsRepository: {},
  });
  await assert.rejects(
    () => service.createReview({ auth: { sub: 'u1' }, body: { orderId: 'bad', rating: 5, tags: [], text: 'ok', mediaIds: [] } }),
    (err) => err && err.code === 'INVALID_ORDER_ID',
  );
});

test("createReview rejects invalid rating", async () => {
  const service = createReviewsService({ ...baseDeps, reviewsRepository: {} });
  await assert.rejects(
    () => service.createReview({ auth: { sub: 'u1' }, body: { orderId: 'ord-1', rating: 10, tags: [], text: 'ok', mediaIds: [] } }),
    (err) => err && err.code === 'INVALID_RATING',
  );
  await assert.rejects(
    () => service.createReview({ auth: { sub: 'u1' }, body: { orderId: 'ord-1', rating: 1.5, tags: [], text: 'ok', mediaIds: [] } }),
    (err) => err && err.code === 'INVALID_RATING',
  );
});

test("createReview rejects invalid tags", async () => {
  const service = createReviewsService({ ...baseDeps, reviewsRepository: {} });
  await assert.rejects(
    () => service.createReview({ auth: { sub: 'u1' }, body: { orderId: 'ord-1', rating: 5, tags: ['unknown'], text: 'ok', mediaIds: [] } }),
    (err) => err && err.code === 'INVALID_REVIEW_TAGS',
  );
  await assert.rejects(
    () => service.createReview({ auth: { sub: 'u1' }, body: { orderId: 'ord-1', rating: 5, tags: 'bad', text: 'ok', mediaIds: [] } }),
    (err) => err && err.code === 'INVALID_REVIEW_TAGS',
  );
});

test("createReview rejects missing text", async () => {
  const service = createReviewsService({ ...baseDeps, reviewsRepository: {} });
  await assert.rejects(
    () => service.createReview({ auth: { sub: 'u1' }, body: { orderId: 'ord-1', rating: 5, tags: ['kind'], text: '   ', mediaIds: [] } }),
    (err) => err && err.code === 'INVALID_REVIEW_TEXT',
  );
});

test("createReview rejects too many media ids", async () => {
  const service = createReviewsService({ ...baseDeps, reviewsRepository: {} });
  await assert.rejects(
    () => service.createReview({ auth: { sub: 'u1' }, body: { orderId: 'ord-1', rating: 5, tags: ['kind'], text: 'ok', mediaIds: [1,2,3,4,5,6,7] } }),
    (err) => err && err.code === 'INVALID_MEDIA_COUNT',
  );
  await assert.rejects(
    () => service.createReview({ auth: { sub: 'u1' }, body: { orderId: 'ord-1', rating: 5, tags: ['kind'], text: 'ok', mediaIds: 'nope' } }),
    (err) => err && err.code === 'INVALID_MEDIA_COUNT',
  );
});

test("createReview rejects invalid media id", async () => {
  let calls = 0;
  const service = createReviewsService({
    ...baseDeps,
    parseObjectIdOrNull: (v) => { calls++; return calls === 1 ? { toString: () => String(v) } : null; },
    reviewsRepository: {},
  });
  await assert.rejects(
    () => service.createReview({ auth: { sub: 'u1' }, body: { orderId: 'ord-1', rating: 5, tags: ['kind'], text: 'ok', mediaIds: ['bad'] } }),
    (err) => err && err.code === 'INVALID_MEDIA_ID',
  );
});

test("createReview rejects when assertCanSubmitReviewForOrder throws", async () => {
  const service = createReviewsService({
    ...baseDeps,
    assertCanSubmitReviewForOrder: () => { throw new Error('nope'); },
    reviewsRepository: {
      findSettings: async () => ({ organizationTimezone: 'UTC', sensitiveTerms: [] }),
      findOrderById: async () => ({ state: 'completed', completedAt: new Date() }),
    },
  });
  await assert.rejects(
    () => service.createReview({ auth: { sub: 'u1' }, body: { orderId: 'ord-1', rating: 5, tags: ['kind'], text: 'ok', mediaIds: [] } }),
    (err) => err && err.code === 'ORDER_NOT_FOUND' && err.status === 404,
  );
});

test("createReview rejects when order is null", async () => {
  const service = createReviewsService({
    ...baseDeps,
    reviewsRepository: {
      findSettings: async () => ({ organizationTimezone: 'UTC', sensitiveTerms: [] }),
      findOrderById: async () => null,
    },
  });
  await assert.rejects(
    () => service.createReview({ auth: { sub: 'u1' }, body: { orderId: 'ord-1', rating: 5, tags: ['kind'], text: 'ok', mediaIds: [] } }),
    (err) => err && err.code === 'ORDER_NOT_FOUND',
  );
});

test("createReview rejects non-completed orders", async () => {
  const service = createReviewsService({
    ...baseDeps,
    reviewsRepository: {
      findSettings: async () => ({ organizationTimezone: 'UTC', sensitiveTerms: [] }),
      findOrderById: async () => ({ state: 'confirmed' }),
    },
  });
  await assert.rejects(
    () => service.createReview({ auth: { sub: 'u1' }, body: { orderId: 'ord-1', rating: 5, tags: ['kind'], text: 'ok', mediaIds: [] } }),
    (err) => err && err.code === 'ORDER_NOT_ELIGIBLE',
  );
});

test("createReview rejects when media doc count does not match", async () => {
  const service = createReviewsService({
    ...baseDeps,
    reviewsRepository: {
      findSettings: async () => ({ organizationTimezone: 'UTC', sensitiveTerms: [] }),
      findOrderById: async () => ({ state: 'completed', completedAt: new Date(), lineItems: [] }),
      findMediaByIds: async () => [],
    },
  });
  await assert.rejects(
    () => service.createReview({ auth: { sub: 'u1' }, body: { orderId: 'ord-1', rating: 5, tags: ['kind'], text: 'ok', mediaIds: ['m1'] } }),
    (err) => err && err.code === 'MEDIA_NOT_FOUND',
  );
});

test("createReview rejects media with wrong purpose", async () => {
  const service = createReviewsService({
    ...baseDeps,
    reviewsRepository: {
      findSettings: async () => ({ organizationTimezone: 'UTC', sensitiveTerms: [] }),
      findOrderById: async () => ({ state: 'completed', completedAt: new Date(), lineItems: [] }),
      findMediaByIds: async () => [{ purpose: 'avatar', mime: 'image/png', byteSize: 10, ownerIds: [{ toString: () => 'u1' }] }],
    },
  });
  await assert.rejects(
    () => service.createReview({ auth: { sub: 'u1' }, body: { orderId: 'ord-1', rating: 5, tags: ['kind'], text: 'ok', mediaIds: ['m1'] } }),
    (err) => err && err.code === 'INVALID_MEDIA_PURPOSE',
  );
});

test("createReview rejects media exceeding size or bad mime", async () => {
  const service = createReviewsService({
    ...baseDeps,
    reviewsRepository: {
      findSettings: async () => ({ organizationTimezone: 'UTC', sensitiveTerms: [] }),
      findOrderById: async () => ({ state: 'completed', completedAt: new Date(), lineItems: [] }),
      findMediaByIds: async () => [{ purpose: 'review', mime: 'image/gif', byteSize: 10, ownerIds: [{ toString: () => 'u1' }] }],
    },
  });
  await assert.rejects(
    () => service.createReview({ auth: { sub: 'u1' }, body: { orderId: 'ord-1', rating: 5, tags: ['kind'], text: 'ok', mediaIds: ['m1'] } }),
    (err) => err && err.code === 'INVALID_MEDIA_FILE',
  );
});

test("createReview happy path with bundles, services, media owned via ownerIds", async () => {
  let insertedDoc = null;
  const service = createReviewsService({
    ...baseDeps,
    reviewsRepository: {
      findSettings: async () => ({ organizationTimezone: 'UTC', sensitiveTerms: [] }),
      findOrderById: async () => ({
        state: 'completed',
        completedAt: new Date(),
        lineItems: [
          { type: 'service', serviceId: { toString: () => 'svc-1' } },
          { type: 'bundle', bundleId: 'bun-1' },
        ],
      }),
      findMediaByIds: async () => [{ purpose: 'review', mime: 'image/png', byteSize: 100, ownerIds: [{ toString: () => 'u1' }] }],
      findBundlesByIds: async () => [{ serviceIds: [{ toString: () => 'svc-2' }, { toString: () => 'svc-3' }] }],
      insertReview: async (doc) => { insertedDoc = doc; return { insertedId: { toString: () => 'rev-ok' } }; },
    },
  });

  const result = await service.createReview({
    auth: { sub: 'u1' },
    body: { orderId: 'ord-1', rating: 4, tags: ['kind', 'thorough'], text: 'great job', mediaIds: ['m1'] },
  });

  assert.deepEqual(result, { id: 'rev-ok', status: 'approved' });
  assert.equal(insertedDoc.serviceIds.length, 3);
  assert.equal(insertedDoc.verified, true);
});

test("createReview converts duplicate-key errors to 409", async () => {
  const service = createReviewsService({
    ...baseDeps,
    reviewsRepository: {
      findSettings: async () => ({ organizationTimezone: 'UTC', sensitiveTerms: [] }),
      findOrderById: async () => ({ state: 'completed', completedAt: new Date(), lineItems: [] }),
      findMediaByIds: async () => [],
      findBundlesByIds: async () => [],
      insertReview: async () => { const e = new Error('dup'); e.code = 11000; throw e; },
    },
  });

  await assert.rejects(
    () => service.createReview({ auth: { sub: 'u1' }, body: { orderId: 'ord-1', rating: 5, tags: ['kind'], text: 'ok', mediaIds: [] } }),
    (err) => err && err.code === 'REVIEW_ALREADY_EXISTS' && err.status === 409,
  );
});

test("createReview rethrows non-dup insertion errors", async () => {
  const service = createReviewsService({
    ...baseDeps,
    reviewsRepository: {
      findSettings: async () => ({ organizationTimezone: 'UTC', sensitiveTerms: [] }),
      findOrderById: async () => ({ state: 'completed', completedAt: new Date(), lineItems: [] }),
      findMediaByIds: async () => [],
      findBundlesByIds: async () => [],
      insertReview: async () => { throw new Error('bang'); },
    },
  });
  await assert.rejects(
    () => service.createReview({ auth: { sub: 'u1' }, body: { orderId: 'ord-1', rating: 5, tags: ['kind'], text: 'ok', mediaIds: [] } }),
    (err) => err && err.message === 'bang',
  );
});

test("approveReviewById updates status and writes audit log", async () => {
  let action = null;
  const service = createReviewsService({
    ...baseDeps,
    reviewsRepository: { moderateReview: async () => ({ matchedCount: 1 }) },
    writeAuditLog: async ({ action: a }) => { action = a; },
  });

  const result = await service.approveReviewById({ auth: { sub: 'admin', username: 'adm' }, req: {}, reviewId: 'rev-1' });
  assert.deepEqual(result, { status: 'approved' });
  assert.equal(action, 'moderation.review.approve');
});

test("approveReviewById throws 404 when no match", async () => {
  const service = createReviewsService({
    ...baseDeps,
    reviewsRepository: { moderateReview: async () => ({ matchedCount: 0 }) },
  });
  await assert.rejects(
    () => service.approveReviewById({ auth: { sub: 'admin' }, req: {}, reviewId: 'x' }),
    (err) => err && err.code === 'REVIEW_NOT_FOUND',
  );
});

test("rejectReviewById updates status and writes audit log", async () => {
  let action = null;
  const service = createReviewsService({
    ...baseDeps,
    reviewsRepository: { moderateReview: async () => ({ matchedCount: 1 }) },
    writeAuditLog: async ({ action: a }) => { action = a; },
  });

  const result = await service.rejectReviewById({ auth: { sub: 'admin' }, req: {}, reviewId: 'rev-1' });
  assert.deepEqual(result, { status: 'rejected' });
  assert.equal(action, 'moderation.review.reject');
});

test("rejectReviewById throws 404 when no match", async () => {
  const service = createReviewsService({
    ...baseDeps,
    reviewsRepository: { moderateReview: async () => ({ matchedCount: 0 }) },
  });
  await assert.rejects(
    () => service.rejectReviewById({ auth: { sub: 'admin' }, req: {}, reviewId: 'x' }),
    (err) => err && err.code === 'REVIEW_NOT_FOUND',
  );
});

test("listModerationQueue returns quarantined reviews mapped", async () => {
  const service = createReviewsService({
    ...baseDeps,
    reviewsRepository: {
      findReviewsByStatus: async (status) => {
        assert.equal(status, 'quarantined');
        return [
          { _id: { toString: () => 'r1' }, orderId: { toString: () => 'o1' }, status: 'quarantined', text: 'hi', rating: 3, createdAt: 'c' },
        ];
      },
    },
  });

  const result = await service.listModerationQueue({ auth: {} });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'r1');
  assert.equal(result[0].orderId, 'o1');
});
