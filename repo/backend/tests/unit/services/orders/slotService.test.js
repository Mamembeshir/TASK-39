const test = require("node:test");
const assert = require("node:assert/strict");

const { createSlotService } = require("../../../../src/services/orders/slotService");

test("releaseSlotCapacity updates each slot id", async () => {
  const calls = [];
  const service = createSlotService({
    getDatabase: () => ({
      collection() {
        return {
          async updateOne(filter, update) {
            calls.push({ filter, update });
          },
        };
      },
    }),
  });

  await service.releaseSlotCapacity(["slot-1", "slot-2"]);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].filter, { _id: "slot-1" });
  assert.equal(calls[0].update.$inc.remainingCapacity, 1);
});

test("releaseSlotCapacity applies units from slot allocations", async () => {
  const calls = [];
  const service = createSlotService({
    getDatabase: () => ({
      collection() {
        return {
          async updateOne(filter, update) {
            calls.push({ filter, update });
          },
        };
      },
    }),
  });

  await service.releaseSlotCapacity([{ slotId: "slot-1", units: 3 }]);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].filter, { _id: "slot-1" });
  assert.equal(calls[0].update.$inc.remainingCapacity, 3);
});

test("findAlternativeSlots returns normalized slot payloads", async () => {
  const service = createSlotService({
    getDatabase: () => ({
      collection() {
        return {
          find() {
            return {
              sort() { return this; },
              limit() { return this; },
              async toArray() {
                return [{ _id: { toString: () => "alt-1" }, startTime: "time", remainingCapacity: 2 }];
              },
            };
          },
        };
      },
    }),
  });

  const result = await service.findAlternativeSlots({ _id: "slot-1", serviceId: "svc-1", startTime: new Date() });
  assert.deepEqual(result, [{ slotId: "alt-1", startTime: "time", remainingCapacity: 2 }]);
});

// ── new tests ─────────────────────────────────────────────────────────────────

test("findAlternativeSlots returns mapped results from DB query", async () => {
  const fakeStartTime = new Date("2024-06-01T10:00:00Z");
  const fakeItems = [
    { _id: { toString: () => "alt-a" }, startTime: fakeStartTime, remainingCapacity: 5 },
    { _id: { toString: () => "alt-b" }, startTime: new Date("2024-06-01T11:00:00Z"), remainingCapacity: 3 },
  ];

  const queryArgs = {};
  const service = createSlotService({
    getDatabase: () => ({
      collection(name) {
        assert.equal(name, "capacity_slots");
        return {
          find(filter) {
            queryArgs.filter = filter;
            return {
              sort(sortSpec) {
                queryArgs.sort = sortSpec;
                return this;
              },
              limit(n) {
                queryArgs.limit = n;
                return this;
              },
              async toArray() {
                return fakeItems;
              },
            };
          },
        };
      },
    }),
  });

  const slot = { _id: "s1", serviceId: "svc-x", startTime: fakeStartTime };
  const result = await service.findAlternativeSlots(slot, 10, 2);

  assert.equal(result.length, 2);
  assert.deepEqual(result[0], { slotId: "alt-a", startTime: fakeStartTime, remainingCapacity: 5 });
  assert.deepEqual(result[1], { slotId: "alt-b", startTime: fakeItems[1].startTime, remainingCapacity: 3 });

  // verify the DB was queried with the right filter and chain calls
  assert.equal(queryArgs.filter.serviceId, "svc-x");
  assert.equal(queryArgs.filter.remainingCapacity.$gte, 2);
  assert.deepEqual(queryArgs.sort, { startTime: 1 });
  assert.equal(queryArgs.limit, 10);
});

test("findAlternativeSlots uses minimum capacity of 1 when requiredCapacityUnits is invalid", async () => {
  const capturedFilters = [];
  const service = createSlotService({
    getDatabase: () => ({
      collection() {
        return {
          find(filter) {
            capturedFilters.push(filter);
            return {
              sort() { return this; },
              limit() { return this; },
              async toArray() { return []; },
            };
          },
        };
      },
    }),
  });

  const slot = { _id: "s1", serviceId: "svc-y", startTime: new Date() };

  // invalid: zero
  await service.findAlternativeSlots(slot, 5, 0);
  assert.equal(capturedFilters[0].remainingCapacity.$gte, 1);

  // invalid: string
  await service.findAlternativeSlots(slot, 5, "many");
  assert.equal(capturedFilters[1].remainingCapacity.$gte, 1);

  // invalid: negative
  await service.findAlternativeSlots(slot, 5, -3);
  assert.equal(capturedFilters[2].remainingCapacity.$gte, 1);
});

test("releaseSlotCapacity handles mixed array of {slotId, units} objects and plain string IDs", async () => {
  const calls = [];
  const service = createSlotService({
    getDatabase: () => ({
      collection() {
        return {
          async updateOne(filter, update) {
            calls.push({ filter, update });
          },
        };
      },
    }),
  });

  await service.releaseSlotCapacity([
    { slotId: "slot-obj", units: 4 },
    "slot-plain",
    { slotId: "slot-obj2", units: 2 },
  ]);

  assert.equal(calls.length, 3);

  const bySlot = Object.fromEntries(calls.map((c) => [c.filter._id, c.update.$inc.remainingCapacity]));
  assert.equal(bySlot["slot-obj"], 4);
  assert.equal(bySlot["slot-plain"], 1);
  assert.equal(bySlot["slot-obj2"], 2);
});

test("releaseSlotCapacity does nothing when given an empty array", async () => {
  let dbCalled = false;
  const service = createSlotService({
    getDatabase: () => {
      dbCalled = true;
      return {
        collection() {
          return {
            async updateOne() {},
          };
        },
      };
    },
  });

  await service.releaseSlotCapacity([]);
  assert.equal(dbCalled, false, "getDatabase should not be called for an empty allocation list");
});

test("startPendingOrderReleaseWorker sets up a 60-second interval", () => {
  const intervals = [];
  const originalSetInterval = global.setInterval;

  // Temporarily replace setInterval to capture registration
  global.setInterval = (fn, ms) => {
    intervals.push({ fn, ms });
    return 999; // fake timer id
  };

  try {
    const service = createSlotService({
      getDatabase: () => ({
        collection() {
          return {
            async findOne() { return null; },
            async updateOne() { return { modifiedCount: 0 }; },
          };
        },
      }),
    });

    service.startPendingOrderReleaseWorker();

    assert.equal(intervals.length, 1, "setInterval should be called once");
    assert.equal(intervals[0].ms, 60 * 1000, "interval should be 60 000 ms");
    assert.equal(typeof intervals[0].fn, "function", "interval callback should be a function");
  } finally {
    global.setInterval = originalSetInterval;
  }
});

// ─── releaseExpiredPendingOrders via worker callback ─────────────────────────

function buildDbForExpired({ orderQueue, updateResults }) {
  const slotUpdates = [];
  const updateCalls = [];
  const findCalls = [];
  const db = {
    collection(name) {
      if (name === "orders") {
        return {
          async findOne(filter, opts) {
            findCalls.push({ filter, opts });
            return orderQueue.shift() ?? null;
          },
          async updateOne(filter, update) {
            updateCalls.push({ filter, update });
            return updateResults.shift() ?? { modifiedCount: 1 };
          },
        };
      }
      if (name === "capacity_slots") {
        return {
          async updateOne(filter, update) {
            slotUpdates.push({ filter, update });
          },
        };
      }
      throw new Error("unexpected collection " + name);
    },
  };
  return { db, slotUpdates, updateCalls, findCalls };
}

async function triggerExpiredWorker(service) {
  const originalSetInterval = global.setInterval;
  let capturedFn = null;
  global.setInterval = (fn) => { capturedFn = fn; return 1; };
  try {
    service.startPendingOrderReleaseWorker();
  } finally {
    global.setInterval = originalSetInterval;
  }
  // the worker's wrapper calls releaseExpiredPendingOrders().catch(...)
  // we need to await its resolution; invoke it and wait a tick
  await Promise.resolve(capturedFn());
  // give microtasks a chance
  await new Promise((r) => setImmediate(r));
}

test("releaseExpiredPendingOrders cancels expired orders and releases slot capacity", async () => {
  const expiredOrder = {
    _id: "order-1",
    slotAllocations: [{ slotId: "slot-a", units: 2 }],
  };
  const { db, slotUpdates, updateCalls } = buildDbForExpired({
    orderQueue: [expiredOrder],
    updateResults: [{ modifiedCount: 1 }],
  });

  const service = createSlotService({ getDatabase: () => db });
  await triggerExpiredWorker(service);

  assert.equal(updateCalls.length, 1);
  assert.equal(updateCalls[0].update.$set.state, "cancelled");
  assert.equal(updateCalls[0].update.$set.cancelledReason, "pending_timeout");
  assert.ok(updateCalls[0].update.$set.capacityReleasedAt instanceof Date);
  assert.equal(slotUpdates.length, 1);
  assert.equal(slotUpdates[0].filter._id, "slot-a");
  assert.equal(slotUpdates[0].update.$inc.remainingCapacity, 2);
});

test("releaseExpiredPendingOrders loops until no more due orders", async () => {
  const orders = [
    { _id: "o1", slotAllocations: ["s1"] },
    { _id: "o2", slotAllocations: ["s2"] },
  ];
  const { db, slotUpdates, findCalls } = buildDbForExpired({
    orderQueue: [...orders],
    updateResults: [{ modifiedCount: 1 }, { modifiedCount: 1 }],
  });

  const service = createSlotService({ getDatabase: () => db });
  await triggerExpiredWorker(service);

  // findOne called 3 times: two orders + one null to end loop
  assert.equal(findCalls.length, 3);
  assert.equal(slotUpdates.length, 2);
});

test("releaseExpiredPendingOrders skips orders that lost the atomic claim", async () => {
  const order = { _id: "o1", slotAllocations: ["s1"] };
  const { db, slotUpdates, updateCalls } = buildDbForExpired({
    orderQueue: [order], // then null ends the loop
    updateResults: [{ modifiedCount: 0 }],
  });

  const service = createSlotService({ getDatabase: () => db });
  await triggerExpiredWorker(service);

  assert.equal(updateCalls.length, 1);
  // No slot release because claim failed
  assert.equal(slotUpdates.length, 0);
});

test("releaseExpiredPendingOrders handles orders with slotIds fallback", async () => {
  const order = { _id: "o1", slotIds: ["legacy-slot"] };
  const { db, slotUpdates } = buildDbForExpired({
    orderQueue: [order],
    updateResults: [{ modifiedCount: 1 }],
  });

  const service = createSlotService({ getDatabase: () => db });
  await triggerExpiredWorker(service);

  assert.equal(slotUpdates.length, 1);
  assert.equal(slotUpdates[0].filter._id, "legacy-slot");
});

test("releaseExpiredPendingOrders does nothing when no orders expired", async () => {
  const { db, slotUpdates, updateCalls } = buildDbForExpired({
    orderQueue: [],
    updateResults: [],
  });
  const service = createSlotService({ getDatabase: () => db });
  await triggerExpiredWorker(service);
  assert.equal(updateCalls.length, 0);
  assert.equal(slotUpdates.length, 0);
});
