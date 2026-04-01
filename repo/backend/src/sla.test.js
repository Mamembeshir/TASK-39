const test = require("node:test");
const assert = require("node:assert/strict");

const { addBusinessMinutes, computeSlaDeadlines } = require("./sla");

const businessHours = {
  monday: { start: "09:00", end: "17:00" },
  tuesday: { start: "09:00", end: "17:00" },
  wednesday: { start: "09:00", end: "17:00" },
  thursday: { start: "09:00", end: "17:00" },
  friday: { start: "09:00", end: "17:00" },
};

test("addBusinessMinutes advances into next business window", () => {
  const start = new Date("2026-03-31T00:30:00.000Z");
  const dueAt = addBusinessMinutes(start, 60, "America/Los_Angeles", businessHours);
  assert.equal(dueAt.toISOString(), "2026-03-31T17:00:00.000Z");
});

test("computeSlaDeadlines returns both deadlines", () => {
  const createdAt = new Date("2026-03-31T16:00:00.000Z");
  const result = computeSlaDeadlines({
    createdAt,
    timeZone: "America/Los_Angeles",
    businessHours,
    firstResponseMinutes: 480,
    resolutionMinutes: 2400,
  });

  assert.equal(result.firstResponseDueAt.toISOString(), "2026-04-01T16:00:00.000Z");
  assert.equal(result.resolutionDueAt.toISOString(), "2026-04-07T16:00:00.000Z");
});

test("addBusinessMinutes rejects negative minute values", () => {
  assert.throws(
    () => addBusinessMinutes(new Date(), -1, "America/Los_Angeles", businessHours),
    (error) => error && error.code === "INVALID_SLA_INPUT",
  );
});
