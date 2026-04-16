const test = require("node:test");
const assert = require("node:assert/strict");

const { createOrdersService } = require("../../../../src/services/orders/ordersService");

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

// ---- Additional coverage tests ----

function makeObjectIdCtor() {
  return function ObjectId(value) {
    this.value = value;
    this.toString = () => String(value || "generated-id");
  };
}

test("createOrder rejects invalid slotId", async () => {
  const service = createOrdersService({
    assertCanAccessOrder: () => {},
    buildQuoteFromRequestPayload: async () => ({}),
    createError,
    createQuoteSignature: () => "sig",
    findAlternativeSlots: async () => [],
    ordersRepository: {},
    releaseSlotCapacity: async () => {},
  });

  await assert.rejects(
    () => service.createOrder({
      authSub: "u1",
      ObjectId: makeObjectIdCtor(),
      payload: {
        lineItems: [],
        slotId: "bad",
        parseObjectIdOrNull: () => null,
      },
    }),
    (err) => err && err.code === "INVALID_SLOT_ID" && err.status === 400,
  );
});

test("createOrder throws SLOT_NOT_FOUND when slot missing", async () => {
  const service = createOrdersService({
    assertCanAccessOrder: () => {},
    buildQuoteFromRequestPayload: async () => ({}),
    createError,
    createQuoteSignature: () => "sig",
    findAlternativeSlots: async () => [],
    ordersRepository: {
      findCapacitySlotById: async () => null,
    },
    releaseSlotCapacity: async () => {},
  });

  await assert.rejects(
    () => service.createOrder({
      authSub: "u1",
      ObjectId: makeObjectIdCtor(),
      payload: {
        lineItems: [],
        slotId: "slot-1",
        parseObjectIdOrNull: (v) => v,
      },
    }),
    (err) => err && err.code === "SLOT_NOT_FOUND" && err.status === 404,
  );
});

test("createOrder returns NOT_SERVICEABLE when quote marks it", async () => {
  const service = createOrdersService({
    assertCanAccessOrder: () => {},
    buildQuoteFromRequestPayload: async () => ({ notServiceable: true, totals: { total: 0 } }),
    createError,
    createQuoteSignature: () => "sig",
    findAlternativeSlots: async () => [],
    ordersRepository: {
      findCapacitySlotById: async () => ({ _id: "s", serviceId: { toString: () => "svc-1" }, startTime: new Date("2026-01-01T10:00:00.000Z") }),
    },
    releaseSlotCapacity: async () => {},
  });

  const result = await service.createOrder({
    authSub: "u1",
    ObjectId: makeObjectIdCtor(),
    payload: {
      lineItems: [{ type: "service", serviceId: "svc-1", quantity: 1 }],
      slotId: "slot-1",
      parseObjectIdOrNull: (v) => v,
    },
  });

  assert.equal(result.status, 409);
  assert.equal(result.body.code, "NOT_SERVICEABLE");
});

test("createOrder returns QUOTE_CHANGED when clientQuoteTotal mismatches", async () => {
  const service = createOrdersService({
    assertCanAccessOrder: () => {},
    buildQuoteFromRequestPayload: async () => ({ notServiceable: false, totals: { total: 100 } }),
    createError,
    createQuoteSignature: () => "sig",
    findAlternativeSlots: async () => [],
    ordersRepository: {
      findCapacitySlotById: async () => ({ _id: "s", serviceId: { toString: () => "svc-1" }, startTime: new Date("2026-01-01T10:00:00.000Z") }),
    },
    releaseSlotCapacity: async () => {},
  });

  const result = await service.createOrder({
    authSub: "u1",
    ObjectId: makeObjectIdCtor(),
    payload: {
      lineItems: [{ type: "service", serviceId: "svc-1", quantity: 1 }],
      slotId: "slot-1",
      clientQuoteTotal: 50,
      parseObjectIdOrNull: (v) => v,
    },
  });

  assert.equal(result.status, 409);
  assert.equal(result.body.code, "QUOTE_CHANGED");
});

test("createOrder rolls back capacity when insertOrder throws", async () => {
  let incremented = null;
  const service = createOrdersService({
    assertCanAccessOrder: () => {},
    buildQuoteFromRequestPayload: async () => ({ notServiceable: false, totals: { total: 100 } }),
    createError,
    createQuoteSignature: () => "sig",
    findAlternativeSlots: async () => [],
    ordersRepository: {
      findCapacitySlotById: async () => ({ _id: "s", serviceId: { toString: () => "svc-1" }, startTime: new Date("2026-01-01T10:00:00.000Z") }),
      decrementCapacitySlot: async () => ({ ok: true }),
      findSettings: async () => ({}),
      insertOrder: async () => { throw new Error("db down"); },
      incrementCapacitySlot: async (_id, units) => { incremented = units; },
    },
    releaseSlotCapacity: async () => {},
  });

  await assert.rejects(
    () => service.createOrder({
      authSub: "u1",
      ObjectId: makeObjectIdCtor(),
      payload: {
        lineItems: [{ type: "service", serviceId: "svc-1", quantity: 1, spec: { headcount: 2 } }],
        slotId: "slot-1",
        parseObjectIdOrNull: (v) => v,
      },
    }),
    (err) => err && err.message === "db down",
  );
  assert.equal(incremented, 2);
});

test("createOrder derives headcount from bundle specs", async () => {
  let decrementedUnits = null;
  const service = createOrdersService({
    assertCanAccessOrder: () => {},
    buildQuoteFromRequestPayload: async () => ({ notServiceable: false, totals: { total: 100 } }),
    createError,
    createQuoteSignature: () => "sig",
    findAlternativeSlots: async () => [],
    ordersRepository: {
      findCapacitySlotById: async () => ({ _id: "s", serviceId: { toString: () => "svc-1" }, startTime: new Date("2026-01-01T10:00:00.000Z") }),
      decrementCapacitySlot: async (_i, units) => { decrementedUnits = units; return { ok: true }; },
      findSettings: async () => ({}),
      insertOrder: async () => ({ insertedId: { toString: () => "ord-1" } }),
      incrementCapacitySlot: async () => {},
    },
    releaseSlotCapacity: async () => {},
  });

  const result = await service.createOrder({
    authSub: "u1",
    ObjectId: makeObjectIdCtor(),
    payload: {
      lineItems: [{
        type: "bundle",
        quantity: 2,
        specs: [
          { serviceId: "svc-1", headcount: 3 },
          { serviceId: "svc-2", spec: { headcount: 5 } },
        ],
      }],
      slotId: "slot-1",
      parseObjectIdOrNull: (v) => v,
    },
  });

  assert.equal(result.status, 201);
  assert.equal(decrementedUnits, 10); // max(3,5) * quantity 2
});

test("listCapacitySlots maps slot documents", async () => {
  const service = createOrdersService({
    assertCanAccessOrder: () => {},
    buildQuoteFromRequestPayload: async () => ({}),
    createError,
    createQuoteSignature: () => "sig",
    findAlternativeSlots: async () => [],
    ordersRepository: {
      listCapacitySlots: async () => [
        { _id: { toString: () => "s1" }, serviceId: { toString: () => "svc-1" }, startTime: "t", remainingCapacity: 3, createdAt: "c", updatedAt: "u" },
        { _id: { toString: () => "s2" }, startTime: "t2", remainingCapacity: 1 },
      ],
    },
    releaseSlotCapacity: async () => {},
  });

  const result = await service.listCapacitySlots();
  assert.equal(result.length, 2);
  assert.equal(result[0].id, "s1");
  assert.equal(result[0].serviceId, "svc-1");
  assert.equal(result[1].serviceId, null);
});

test("createCapacitySlot validates required fields", async () => {
  const service = createOrdersService({
    assertCanAccessOrder: () => {},
    buildQuoteFromRequestPayload: async () => ({}),
    createError,
    createQuoteSignature: () => "sig",
    findAlternativeSlots: async () => [],
    ordersRepository: {},
    releaseSlotCapacity: async () => {},
  });

  await assert.rejects(
    () => service.createCapacitySlot({
      payload: { serviceId: "bad" },
      ObjectId: makeObjectIdCtor(),
      parseObjectIdOrNull: () => null,
    }),
    (err) => err && err.code === "INVALID_SERVICE_ID",
  );

  await assert.rejects(
    () => service.createCapacitySlot({
      payload: { serviceId: "ok", startTime: "not-a-date", remainingCapacity: 1 },
      ObjectId: makeObjectIdCtor(),
      parseObjectIdOrNull: (v) => v,
    }),
    (err) => err && err.code === "INVALID_START_TIME",
  );

  await assert.rejects(
    () => service.createCapacitySlot({
      payload: { serviceId: "ok", startTime: "2026-01-01T10:00:00Z", remainingCapacity: 0 },
      ObjectId: makeObjectIdCtor(),
      parseObjectIdOrNull: (v) => v,
    }),
    (err) => err && err.code === "INVALID_CAPACITY",
  );
});

test("createCapacitySlot inserts and returns id", async () => {
  const service = createOrdersService({
    assertCanAccessOrder: () => {},
    buildQuoteFromRequestPayload: async () => ({}),
    createError,
    createQuoteSignature: () => "sig",
    findAlternativeSlots: async () => [],
    ordersRepository: {
      insertCapacitySlot: async () => ({ insertedId: { toString: () => "new-slot" } }),
    },
    releaseSlotCapacity: async () => {},
  });

  const result = await service.createCapacitySlot({
    payload: { serviceId: "svc", startTime: "2026-01-01T10:00:00Z", remainingCapacity: 5 },
    ObjectId: makeObjectIdCtor(),
    parseObjectIdOrNull: (v) => v,
  });
  assert.equal(result.id, "new-slot");
});

test("updateCapacitySlot returns NOT_FOUND when slot missing", async () => {
  const service = createOrdersService({
    assertCanAccessOrder: () => {},
    buildQuoteFromRequestPayload: async () => ({}),
    createError,
    createQuoteSignature: () => "sig",
    findAlternativeSlots: async () => [],
    ordersRepository: {
      updateCapacitySlot: async () => ({ matchedCount: 0 }),
    },
    releaseSlotCapacity: async () => {},
  });

  await assert.rejects(
    () => service.updateCapacitySlot({
      slotId: "s1",
      payload: { startTime: "2026-01-01T10:00:00Z", remainingCapacity: 2 },
      parseObjectIdOrNull: (v) => ({ toString: () => String(v) }),
    }),
    (err) => err && err.code === "SLOT_NOT_FOUND",
  );
});

test("updateCapacitySlot rejects invalid slot id", async () => {
  const service = createOrdersService({
    assertCanAccessOrder: () => {},
    buildQuoteFromRequestPayload: async () => ({}),
    createError,
    createQuoteSignature: () => "sig",
    findAlternativeSlots: async () => [],
    ordersRepository: {},
    releaseSlotCapacity: async () => {},
  });

  await assert.rejects(
    () => service.updateCapacitySlot({
      slotId: "bad",
      payload: { startTime: "2026-01-01T10:00:00Z", remainingCapacity: 1 },
      parseObjectIdOrNull: () => null,
    }),
    (err) => err && err.code === "INVALID_SLOT_ID",
  );
});

test("updateCapacitySlot succeeds when matched", async () => {
  const service = createOrdersService({
    assertCanAccessOrder: () => {},
    buildQuoteFromRequestPayload: async () => ({}),
    createError,
    createQuoteSignature: () => "sig",
    findAlternativeSlots: async () => [],
    ordersRepository: {
      updateCapacitySlot: async () => ({ matchedCount: 1 }),
    },
    releaseSlotCapacity: async () => {},
  });
  const result = await service.updateCapacitySlot({
    slotId: "s1",
    payload: { startTime: "2026-01-01T10:00:00Z", remainingCapacity: 2 },
    parseObjectIdOrNull: (v) => ({ toString: () => String(v) }),
  });
  assert.equal(result.id, "s1");
});

test("deleteCapacitySlot handles missing and success paths", async () => {
  const notFound = createOrdersService({
    assertCanAccessOrder: () => {},
    buildQuoteFromRequestPayload: async () => ({}),
    createError,
    createQuoteSignature: () => "sig",
    findAlternativeSlots: async () => [],
    ordersRepository: { deleteCapacitySlot: async () => ({ deletedCount: 0 }) },
    releaseSlotCapacity: async () => {},
  });
  await assert.rejects(
    () => notFound.deleteCapacitySlot({ slotId: "s", parseObjectIdOrNull: (v) => v }),
    (err) => err && err.code === "SLOT_NOT_FOUND",
  );

  const badId = createOrdersService({
    assertCanAccessOrder: () => {},
    buildQuoteFromRequestPayload: async () => ({}),
    createError,
    createQuoteSignature: () => "sig",
    findAlternativeSlots: async () => [],
    ordersRepository: {},
    releaseSlotCapacity: async () => {},
  });
  await assert.rejects(
    () => badId.deleteCapacitySlot({ slotId: "x", parseObjectIdOrNull: () => null }),
    (err) => err && err.code === "INVALID_SLOT_ID",
  );

  const ok = createOrdersService({
    assertCanAccessOrder: () => {},
    buildQuoteFromRequestPayload: async () => ({}),
    createError,
    createQuoteSignature: () => "sig",
    findAlternativeSlots: async () => [],
    ordersRepository: { deleteCapacitySlot: async () => ({ deletedCount: 1 }) },
    releaseSlotCapacity: async () => {},
  });
  const result = await ok.deleteCapacitySlot({ slotId: "s", parseObjectIdOrNull: (v) => v });
  assert.deepEqual(result, { status: "ok" });
});

test("getOrderById masks PII for non-privileged users", async () => {
  const service = createOrdersService({
    assertCanAccessOrder: () => {},
    buildQuoteFromRequestPayload: async () => ({}),
    createError,
    createQuoteSignature: () => "sig",
    findAlternativeSlots: async () => [],
    ordersRepository: {
      findOrderById: async () => ({ _id: { toString: () => "ord-1" }, state: "confirmed", lineItems: [], pricingSnapshot: { total: 50 }, customerId: "cust-1" }),
      findUserById: async () => ({ phoneEncrypted: "enc1", addressEncrypted: "enc2" }),
    },
    releaseSlotCapacity: async () => {},
  });

  const result = await service.getOrderById({
    auth: { sub: "u1" },
    orderId: "ord-1",
    isPrivileged: false,
    decryptField: (v) => (v === "enc1" ? "555-123-4567" : "123 Main St"),
    maskPhone: () => "***-***-4567",
    maskAddress: () => "*** St",
  });

  assert.equal(result.order.customerContact.phone, "***-***-4567");
  assert.equal(result.order.customerContact.address, "*** St");
});

test("getOrderById returns full PII for privileged users", async () => {
  const service = createOrdersService({
    assertCanAccessOrder: () => {},
    buildQuoteFromRequestPayload: async () => ({}),
    createError,
    createQuoteSignature: () => "sig",
    findAlternativeSlots: async () => [],
    ordersRepository: {
      findOrderById: async () => ({ _id: { toString: () => "ord-1" }, state: "confirmed", lineItems: [], pricingSnapshot: { total: 50 }, customerId: "cust-1" }),
      findUserById: async () => ({ phoneEncrypted: "enc1", addressEncrypted: "enc2" }),
    },
    releaseSlotCapacity: async () => {},
  });

  const result = await service.getOrderById({
    auth: { sub: "u1", roles: ["staff"] },
    orderId: "ord-1",
    isPrivileged: true,
    decryptField: (v) => (v === "enc1" ? "555" : "addr"),
    maskPhone: () => "mask",
    maskAddress: () => "mask",
  });

  assert.equal(result.order.customerContact.phone, "555");
  assert.equal(result.order.customerContact.address, "addr");
});

test("getOrderById throws 404 when access denied", async () => {
  const service = createOrdersService({
    assertCanAccessOrder: () => { throw new Error("forbidden"); },
    buildQuoteFromRequestPayload: async () => ({}),
    createError,
    createQuoteSignature: () => "sig",
    findAlternativeSlots: async () => [],
    ordersRepository: {
      findOrderById: async () => ({ _id: { toString: () => "ord-1" } }),
    },
    releaseSlotCapacity: async () => {},
  });

  await assert.rejects(
    () => service.getOrderById({ auth: {}, orderId: "ord-1", isPrivileged: false, decryptField: () => "", maskPhone: () => "", maskAddress: () => "" }),
    (err) => err && err.code === "ORDER_NOT_FOUND",
  );
});

test("getOrderById throws 404 when order null", async () => {
  const service = createOrdersService({
    assertCanAccessOrder: () => {},
    buildQuoteFromRequestPayload: async () => ({}),
    createError,
    createQuoteSignature: () => "sig",
    findAlternativeSlots: async () => [],
    ordersRepository: { findOrderById: async () => null },
    releaseSlotCapacity: async () => {},
  });

  await assert.rejects(
    () => service.getOrderById({ auth: {}, orderId: "x", isPrivileged: false, decryptField: () => "", maskPhone: () => "", maskAddress: () => "" }),
    (err) => err && err.code === "ORDER_NOT_FOUND",
  );
});

test("listOrdersForUser maps user's orders", async () => {
  const service = createOrdersService({
    assertCanAccessOrder: () => {},
    buildQuoteFromRequestPayload: async () => ({}),
    createError,
    createQuoteSignature: () => "sig",
    findAlternativeSlots: async () => [],
    ordersRepository: {
      findOrdersByCustomerId: async () => [
        { _id: { toString: () => "o1" }, state: "confirmed", pricingSnapshot: { total: 50 }, createdAt: "c", updatedAt: "u", slotStart: "s" },
        { _id: { toString: () => "o2" }, state: "pending_confirmation", pricingSnapshot: null },
      ],
    },
    releaseSlotCapacity: async () => {},
  });

  const result = await service.listOrdersForUser({ auth: { sub: "u1" }, ObjectId: makeObjectIdCtor() });
  assert.equal(result.length, 2);
  assert.equal(result[0].id, "o1");
  assert.equal(result[0].total, 50);
  assert.equal(result[1].total, null);
});

test("cancelOrderById rejects orders in non-cancellable state", async () => {
  const service = createOrdersService({
    assertCanAccessOrder: () => {},
    buildQuoteFromRequestPayload: async () => ({}),
    createError,
    createQuoteSignature: () => "sig",
    findAlternativeSlots: async () => [],
    ordersRepository: {
      findOrderById: async () => ({ state: "completed" }),
    },
    releaseSlotCapacity: async () => {},
  });

  await assert.rejects(
    () => service.cancelOrderById({ auth: {}, orderId: "o1", ObjectId: makeObjectIdCtor(), writeAuditLog: async () => {}, req: {} }),
    (err) => err && err.code === "INVALID_ORDER_STATE",
  );
});

test("cancelOrderById throws 404 on access denial and missing order", async () => {
  const deny = createOrdersService({
    assertCanAccessOrder: () => { throw new Error("nope"); },
    buildQuoteFromRequestPayload: async () => ({}),
    createError,
    createQuoteSignature: () => "sig",
    findAlternativeSlots: async () => [],
    ordersRepository: { findOrderById: async () => ({ state: "pending_confirmation" }) },
    releaseSlotCapacity: async () => {},
  });
  await assert.rejects(
    () => deny.cancelOrderById({ auth: {}, orderId: "o1", ObjectId: makeObjectIdCtor(), writeAuditLog: async () => {}, req: {} }),
    (err) => err && err.code === "ORDER_NOT_FOUND",
  );

  const missing = createOrdersService({
    assertCanAccessOrder: () => {},
    buildQuoteFromRequestPayload: async () => ({}),
    createError,
    createQuoteSignature: () => "sig",
    findAlternativeSlots: async () => [],
    ordersRepository: { findOrderById: async () => null },
    releaseSlotCapacity: async () => {},
  });
  await assert.rejects(
    () => missing.cancelOrderById({ auth: {}, orderId: "o1", ObjectId: makeObjectIdCtor(), writeAuditLog: async () => {}, req: {} }),
    (err) => err && err.code === "ORDER_NOT_FOUND",
  );
});

test("cancelOrderById throws when modifiedCount is zero", async () => {
  const service = createOrdersService({
    assertCanAccessOrder: () => {},
    buildQuoteFromRequestPayload: async () => ({}),
    createError,
    createQuoteSignature: () => "sig",
    findAlternativeSlots: async () => [],
    ordersRepository: {
      findOrderById: async () => ({ state: "confirmed", slotAllocations: [] }),
      cancelOrder: async () => ({ modifiedCount: 0 }),
    },
    releaseSlotCapacity: async () => {},
  });
  await assert.rejects(
    () => service.cancelOrderById({ auth: {}, orderId: "o1", ObjectId: makeObjectIdCtor(), writeAuditLog: async () => {}, req: {} }),
    (err) => err && err.code === "INVALID_ORDER_STATE",
  );
});

test("completeOrderById succeeds and writes audit log", async () => {
  let action = null;
  const service = createOrdersService({
    assertCanAccessOrder: () => {},
    buildQuoteFromRequestPayload: async () => ({}),
    createError,
    createQuoteSignature: () => "sig",
    findAlternativeSlots: async () => [],
    ordersRepository: {
      completeOrder: async () => ({ modifiedCount: 1 }),
    },
    releaseSlotCapacity: async () => {},
  });

  const result = await service.completeOrderById({
    auth: { sub: "u1", username: "admin" },
    orderId: "o1",
    ObjectId: makeObjectIdCtor(),
    writeAuditLog: async ({ action: a }) => { action = a; },
    req: {},
  });

  assert.deepEqual(result, { status: "ok", state: "completed" });
  assert.equal(action, "order.status.completed");
});

test("completeOrderById throws when modifiedCount is zero", async () => {
  const service = createOrdersService({
    assertCanAccessOrder: () => {},
    buildQuoteFromRequestPayload: async () => ({}),
    createError,
    createQuoteSignature: () => "sig",
    findAlternativeSlots: async () => [],
    ordersRepository: {
      completeOrder: async () => ({ modifiedCount: 0 }),
    },
    releaseSlotCapacity: async () => {},
  });

  await assert.rejects(
    () => service.completeOrderById({
      auth: {},
      orderId: "o1",
      ObjectId: makeObjectIdCtor(),
      writeAuditLog: async () => {},
      req: {},
    }),
    (err) => err && err.code === "INVALID_ORDER_STATE",
  );
});
