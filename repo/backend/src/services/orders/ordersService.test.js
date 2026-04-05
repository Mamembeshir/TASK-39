const test = require("node:test");
const assert = require("node:assert/strict");

const { createOrdersService } = require("./ordersService");

function createError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

test("createOrder returns quote changed when provided signature is stale", async () => {
  const service = createOrdersService({
    assertCanAccessOrder: () => {},
    buildQuoteFromRequestPayload: async () => ({ notServiceable: false, totals: { total: 100 } }),
    createError,
    createQuoteSignature: () => "fresh-signature",
    findAlternativeSlots: async () => [],
    ordersRepository: {
      findCapacitySlotById: async () => ({ _id: "slot-1", serviceId: { toString: () => "svc-1" }, startTime: new Date("2026-01-01T10:00:00.000Z") }),
    },
    releaseSlotCapacity: async () => {},
  });

  const result = await service.createOrder({
    authSub: "65f000000000000000000001",
    ObjectId: function ObjectId(value) { this.value = value; },
    payload: {
      lineItems: [{ type: "service", serviceId: "svc-1", durationMinutes: 60, quantity: 1 }],
      slotId: "slot-1",
      bookingRequestedAt: "2026-01-01T09:00:00.000Z",
      milesFromDepot: 5,
      jurisdictionId: "j1",
      quoteSignature: "stale-signature",
      parseObjectIdOrNull: (value) => value,
    },
  });

  assert.equal(result.status, 409);
  assert.equal(result.body.code, "QUOTE_CHANGED");
  assert.equal(result.body.currentQuote.quoteSignature, "fresh-signature");
});

test("createOrder returns slot unavailable alternatives when capacity decrement fails", async () => {
  const service = createOrdersService({
    assertCanAccessOrder: () => {},
    buildQuoteFromRequestPayload: async () => ({ notServiceable: false, totals: { total: 100 } }),
    createError,
    createQuoteSignature: () => "sig",
    findAlternativeSlots: async () => [{ slotId: "alt-1" }],
    ordersRepository: {
      findCapacitySlotById: async () => ({ _id: "slot-1", serviceId: { toString: () => "svc-1" }, startTime: new Date("2026-01-01T10:00:00.000Z") }),
      decrementCapacitySlot: async () => null,
    },
    releaseSlotCapacity: async () => {},
  });

  const result = await service.createOrder({
    authSub: "65f000000000000000000001",
    ObjectId: function ObjectId(value) { this.value = value; },
    payload: {
      lineItems: [{ type: "service", serviceId: "svc-1", durationMinutes: 60, quantity: 1 }],
      slotId: "slot-1",
      bookingRequestedAt: "2026-01-01T09:00:00.000Z",
      milesFromDepot: 5,
      jurisdictionId: "j1",
      parseObjectIdOrNull: (value) => value,
    },
  });

  assert.equal(result.status, 409);
  assert.equal(result.body.code, "SLOT_UNAVAILABLE");
  assert.deepEqual(result.body.alternatives, [{ slotId: "alt-1" }]);
});

test("cancelOrderById releases slot capacity and writes audit log", async () => {
  let releasedSlotIds = null;
  let auditAction = null;
  const service = createOrdersService({
    assertCanAccessOrder: () => {},
    buildQuoteFromRequestPayload: async () => ({}),
    createError,
    createQuoteSignature: () => "sig",
    findAlternativeSlots: async () => [],
    ordersRepository: {
      findOrderById: async () => ({ _id: "ord-1", state: "confirmed", slotIds: ["slot-1"] }),
      cancelOrder: async () => ({ modifiedCount: 1 }),
    },
    releaseSlotCapacity: async (slotIds) => {
      releasedSlotIds = slotIds;
    },
  });

  const result = await service.cancelOrderById({
    auth: { sub: "65f000000000000000000002", username: "admin_demo" },
    orderId: "ord-1",
    ObjectId: function ObjectId(value) { this.value = value; },
    req: {},
    writeAuditLog: async ({ action }) => {
      auditAction = action;
    },
  });

  assert.deepEqual(result, { status: "ok", state: "cancelled" });
  assert.deepEqual(releasedSlotIds, ["slot-1"]);
  assert.equal(auditAction, "order.status.cancelled");
});

test("createOrder rejects slots that do not match selected services", async () => {
  let alternativesRequestedForServiceId = null;
  const service = createOrdersService({
    assertCanAccessOrder: () => {},
    buildQuoteFromRequestPayload: async () => ({ notServiceable: false, totals: { total: 100 } }),
    createError,
    createQuoteSignature: () => "sig",
    findAlternativeSlots: async (slot) => {
      alternativesRequestedForServiceId = slot.serviceId?.toString?.() || null;
      return [{ slotId: "alt-slot-1" }];
    },
    ordersRepository: {
      findCapacitySlotById: async () => ({ _id: "slot-1", serviceId: { toString: () => "svc-2" }, startTime: new Date("2026-01-01T10:00:00.000Z") }),
    },
    releaseSlotCapacity: async () => {},
  });

  const result = await service.createOrder({
    authSub: "65f000000000000000000001",
    ObjectId: function ObjectId(value) { this.value = value; },
    payload: {
      lineItems: [{ type: "service", serviceId: "svc-1", durationMinutes: 60, quantity: 1 }],
      slotId: "slot-1",
      bookingRequestedAt: "2026-01-01T09:00:00.000Z",
      milesFromDepot: 5,
      jurisdictionId: "j1",
      parseObjectIdOrNull: (value) => value,
    },
  });

  assert.equal(result.status, 409);
  assert.equal(result.body.code, "SLOT_SERVICE_MISMATCH");
  assert.deepEqual(result.body.alternatives, [{ slotId: "alt-slot-1" }]);
  assert.equal(alternativesRequestedForServiceId, "svc-1");
});

test("createOrder decrements capacity using derived headcount units", async () => {
  let decrementedUnits = null;
  const service = createOrdersService({
    assertCanAccessOrder: () => {},
    buildQuoteFromRequestPayload: async () => ({ notServiceable: false, totals: { total: 100 } }),
    createError,
    createQuoteSignature: () => "sig",
    findAlternativeSlots: async () => [],
    ordersRepository: {
      findCapacitySlotById: async () => ({ _id: "slot-1", serviceId: { toString: () => "svc-1" }, startTime: new Date("2026-01-01T10:00:00.000Z") }),
      decrementCapacitySlot: async (_slotId, units) => {
        decrementedUnits = units;
        return { _id: "slot-1", remainingCapacity: 1 };
      },
      findSettings: async () => ({ pendingConfirmationTimeoutMinutes: 15 }),
      insertOrder: async () => ({ insertedId: { toString: () => "ord-1" } }),
      incrementCapacitySlot: async () => {},
    },
    releaseSlotCapacity: async () => {},
  });

  const result = await service.createOrder({
    authSub: "65f000000000000000000001",
    ObjectId: function ObjectId(value) { this.value = value; this.toString = () => String(value); },
    payload: {
      lineItems: [{ type: "service", serviceId: "svc-1", durationMinutes: 60, quantity: 1, spec: { headcount: 3 } }],
      slotId: "slot-1",
      bookingRequestedAt: "2026-01-01T09:00:00.000Z",
      milesFromDepot: 5,
      jurisdictionId: "j1",
      parseObjectIdOrNull: (value) => value,
    },
  });

  assert.equal(result.status, 201);
  assert.equal(decrementedUnits, 3);
});

test("createOrder ignores client bookingRequestedAt for pricing and storage", async () => {
  let quoteRequestedAt = null;
  let storedRequestedAt = null;
  const now = new Date();
  const service = createOrdersService({
    assertCanAccessOrder: () => {},
    buildQuoteFromRequestPayload: async ({ bookingRequestedAt }) => {
      quoteRequestedAt = bookingRequestedAt;
      return { notServiceable: false, totals: { total: 100 } };
    },
    createError,
    createQuoteSignature: () => 'sig',
    findAlternativeSlots: async () => [],
    ordersRepository: {
      findCapacitySlotById: async () => ({ _id: 'slot-1', serviceId: { toString: () => 'svc-1' }, startTime: new Date('2026-01-01T10:00:00.000Z') }),
      decrementCapacitySlot: async () => ({ _id: 'slot-1', remainingCapacity: 1 }),
      findSettings: async () => ({ pendingConfirmationTimeoutMinutes: 15 }),
      insertOrder: async (doc) => {
        storedRequestedAt = doc.bookingRequestedAt;
        return { insertedId: { toString: () => 'ord-1' } };
      },
      incrementCapacitySlot: async () => {},
    },
    releaseSlotCapacity: async () => {},
  });

  const result = await service.createOrder({
    authSub: '65f000000000000000000001',
    ObjectId: function ObjectId(value) { this.value = value; this.toString = () => String(value); },
    payload: {
      lineItems: [{ type: 'service', serviceId: 'svc-1', durationMinutes: 60, quantity: 1, spec: { headcount: 1 } }],
      slotId: 'slot-1',
      bookingRequestedAt: '2000-01-01T00:00:00.000Z',
      milesFromDepot: 5,
      jurisdictionId: 'j1',
      parseObjectIdOrNull: (value) => value,
    },
  });

  assert.equal(result.status, 201);
  assert.ok(quoteRequestedAt);
  assert.ok(storedRequestedAt instanceof Date);
  assert.ok(Math.abs(new Date(quoteRequestedAt).getTime() - now.getTime()) < 5000);
  assert.ok(Math.abs(storedRequestedAt.getTime() - now.getTime()) < 5000);
});
