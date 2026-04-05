const test = require("node:test");
const assert = require("node:assert/strict");

const { createQuoteService } = require("./quoteService");

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
