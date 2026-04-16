const test = require("node:test");
const assert = require("node:assert/strict");

const { createQuoteService } = require("../../../../src/services/quote/quoteService");

function createError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

test("buildQuoteFromRequestPayload ignores client booking timestamp for pricing", async () => {
  const now = new Date();
  const service = createQuoteService({
    calculateQuote: ({ bookingRequestedAt }) => ({ bookingRequestedAt }),
    createError,
    getDatabase: () => ({
      collection() {
        return {
          async findOne() {
            return { _id: "US-CA", taxRequired: false, taxRate: 0 };
          },
          find() {
            return { toArray: async () => [] };
          },
        };
      },
    }),
    parseObjectIdOrNull: (value) => value,
  });

  const result = await service.buildQuoteFromRequestPayload({
    lineItems: [],
    slotStart: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
    bookingRequestedAt: new Date("2000-01-01T00:00:00.000Z").toISOString(),
    milesFromDepot: 5,
    jurisdictionId: "US-CA",
    sameDayPriority: true,
    taxEnabled: true,
  });

  const resultDate = new Date(result.bookingRequestedAt);
  assert.ok(Math.abs(resultDate.getTime() - now.getTime()) < 5000);
});

test("buildQuoteFromRequestPayload rejects invalid bookingRequestedAt when provided", async () => {
  const service = createQuoteService({
    calculateQuote: () => ({}),
    createError,
    getDatabase: () => ({
      collection() {
        return {
          async findOne() {
            return { _id: "US-CA", taxRequired: false, taxRate: 0 };
          },
          find() {
            return { toArray: async () => [] };
          },
        };
      },
    }),
    parseObjectIdOrNull: (value) => value,
  });

  await assert.rejects(
    () =>
      service.buildQuoteFromRequestPayload({
        lineItems: [],
        slotStart: new Date().toISOString(),
        bookingRequestedAt: "not-a-date",
        milesFromDepot: 5,
        jurisdictionId: "US-CA",
        sameDayPriority: false,
        taxEnabled: true,
      }),
    (error) => error && error.code === "INVALID_BOOKING_REQUESTED_AT",
  );
});

// ---------- Additional coverage ----------

const { createQuoteSignature } = require("../../../../src/services/quote/quoteService");

function fakeDbFactory(overrides = {}) {
  const jurisdiction = overrides.jurisdiction === undefined
    ? { _id: "US-CA", taxRequired: false, taxRate: 0 }
    : overrides.jurisdiction;
  const bundles = overrides.bundles || [];
  const services = overrides.services || [];
  const settings = overrides.settings || { organizationTimezone: "America/Los_Angeles" };
  return () => ({
    collection(name) {
      return {
        async findOne() {
          if (name === "jurisdictions") return jurisdiction;
          if (name === "settings") return settings;
          return null;
        },
        find() {
          return {
            toArray: async () => {
              if (name === "bundles") return bundles;
              if (name === "services") return services;
              return [];
            },
          };
        },
      };
    },
  });
}

test("buildQuoteFromRequestPayload throws 400 when jurisdictionId missing", async () => {
  const service = createQuoteService({
    calculateQuote: () => ({}),
    createError,
    getDatabase: fakeDbFactory(),
    parseObjectIdOrNull: (v) => v,
  });
  await assert.rejects(
    () => service.buildQuoteFromRequestPayload({ lineItems: [], jurisdictionId: "" }),
    (e) => e.code === "INVALID_JURISDICTION",
  );
});

test("buildQuoteFromRequestPayload throws INVALID_JURISDICTION when not found in db", async () => {
  const service = createQuoteService({
    calculateQuote: () => ({}),
    createError,
    getDatabase: fakeDbFactory({ jurisdiction: null }),
    parseObjectIdOrNull: (v) => v,
  });
  await assert.rejects(
    () => service.buildQuoteFromRequestPayload({
      lineItems: [], jurisdictionId: "US-ZZ", milesFromDepot: 1,
    }),
    (e) => e.code === "INVALID_JURISDICTION",
  );
});

test("buildQuoteFromRequestPayload gathers service & bundle ids and calls calculateQuote", async () => {
  let captured = null;
  const service = createQuoteService({
    calculateQuote: (args) => { captured = args; return { ok: true }; },
    createError,
    getDatabase: fakeDbFactory({
      bundles: [{ _id: { toString: () => "b1" }, components: [{ serviceId: { toString: () => "s2" } }], serviceIds: [{ toString: () => "s3" }] }],
      services: [{ _id: { toString: () => "s1" } }, { _id: { toString: () => "s2" } }, { _id: { toString: () => "s3" } }],
    }),
    parseObjectIdOrNull: (v) => v,
  });

  const out = await service.buildQuoteFromRequestPayload({
    lineItems: [
      { type: "service", serviceId: "s1", quantity: 1 },
      { type: "bundle", bundleId: "b1", specs: [{ serviceId: "s2" }] },
    ],
    slotStart: new Date().toISOString(),
    milesFromDepot: "10",
    jurisdictionId: "US-CA",
    sameDayPriority: false,
    taxEnabled: true,
  });
  assert.equal(out.ok, true);
  assert.equal(captured.milesFromDepot, 10);
  assert.equal(captured.organizationTimezone, "America/Los_Angeles");
  assert.equal(Object.keys(captured.bundlesById).length, 1);
  assert.ok(Object.keys(captured.servicesById).length >= 1);
});

test("buildQuoteFromRequestPayload uses default timezone when settings missing", async () => {
  let captured = null;
  const service = createQuoteService({
    calculateQuote: (args) => { captured = args; return {}; },
    createError,
    getDatabase: fakeDbFactory({ settings: null }),
    parseObjectIdOrNull: (v) => v,
  });
  await service.buildQuoteFromRequestPayload({
    lineItems: [], jurisdictionId: "US-CA", milesFromDepot: 0,
  });
  assert.equal(captured.organizationTimezone, "America/Los_Angeles");
});

test("buildQuoteFromRequestPayload wraps calculateQuote errors in 400", async () => {
  const service = createQuoteService({
    calculateQuote: () => { const e = new Error("bad stuff"); e.code = "BAD_LINE"; throw e; },
    createError,
    getDatabase: fakeDbFactory(),
    parseObjectIdOrNull: (v) => v,
  });
  await assert.rejects(
    () => service.buildQuoteFromRequestPayload({
      lineItems: [], jurisdictionId: "US-CA", milesFromDepot: 0,
    }),
    (e) => e.status === 400 && e.code === "BAD_LINE",
  );
});

test("buildQuoteFromRequestPayload wraps calculateQuote errors without code as INVALID_QUOTE", async () => {
  const service = createQuoteService({
    calculateQuote: () => { throw new Error("boom"); },
    createError,
    getDatabase: fakeDbFactory(),
    parseObjectIdOrNull: (v) => v,
  });
  await assert.rejects(
    () => service.buildQuoteFromRequestPayload({
      lineItems: [], jurisdictionId: "US-CA", milesFromDepot: 0,
    }),
    (e) => e.code === "INVALID_QUOTE",
  );
});

test("buildQuoteFromRequestPayload handles null/invalid line items gracefully", async () => {
  let captured = null;
  const service = createQuoteService({
    calculateQuote: (args) => { captured = args; return {}; },
    createError,
    getDatabase: fakeDbFactory(),
    parseObjectIdOrNull: (v) => v,
  });
  await service.buildQuoteFromRequestPayload({
    lineItems: [null, { type: "other" }, { type: "service" }, { type: "bundle" }],
    jurisdictionId: "US-CA", milesFromDepot: 2,
  });
  assert.deepEqual(captured.servicesById, {});
  assert.deepEqual(captured.bundlesById, {});
});

test("createQuoteSignature produces stable hex digest for equivalent payloads", () => {
  const q1 = {
    itemizedLines: [{ type: "service", serviceId: "s1", bundleId: null, quantity: 1, durationMinutes: 30, unitPrice: 100, lineTotal: 100 }],
    travel: { miles: 5 }, totals: { grand: 100 }, jurisdiction: "US-CA",
    notServiceable: false, code: "Q1",
  };
  const q2 = JSON.parse(JSON.stringify(q1));
  const sig1 = createQuoteSignature(q1);
  const sig2 = createQuoteSignature(q2);
  assert.equal(sig1, sig2);
  assert.match(sig1, /^[a-f0-9]{64}$/);
});

test("createQuoteSignature changes when payload changes", () => {
  const q = { itemizedLines: [], travel: {}, totals: { grand: 100 }, jurisdiction: "US-CA", notServiceable: false, code: "Q1" };
  const a = createQuoteSignature(q);
  const b = createQuoteSignature({ ...q, totals: { grand: 200 } });
  assert.notEqual(a, b);
});

test("createQuoteSignature tolerates missing itemizedLines", () => {
  const sig = createQuoteSignature({ totals: {}, jurisdiction: "US-CA" });
  assert.match(sig, /^[a-f0-9]{64}$/);
});
