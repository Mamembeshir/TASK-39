const test = require("node:test");
const assert = require("node:assert/strict");

const { createSlotService } = require("./slotService");

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
