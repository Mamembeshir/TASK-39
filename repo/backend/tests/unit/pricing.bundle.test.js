const test = require("node:test");
const assert = require("node:assert/strict");

const { calculateQuote } = require("../../src/pricing");

test("bundle pricing uses per-component defaults and overrides in totals", () => {
  const quote = calculateQuote({
    lineItems: [
      {
        type: "bundle",
        bundleId: "bundle-1",
        quantity: 1,
        specs: [{ serviceId: "svc-2", headcount: 2, addOnIds: ["addon-1"] }],
      },
    ],
    servicesById: {
      "svc-1": {
        title: "Service One",
        specDefinitions: { headcount: [1, 2], toolsMode: ["provider", "customer"] },
        addOns: [],
        pricing: { basePrice: 100, durationAdjustments: { "60": 0 } },
      },
      "svc-2": {
        title: "Service Two",
        specDefinitions: { headcount: [1, 2], toolsMode: ["provider", "customer"] },
        addOns: ["addon-1"],
        pricing: { basePrice: 80, durationAdjustments: { "30": 0 } },
      },
    },
    bundlesById: {
      "bundle-1": {
        title: "Starter Bundle",
        pricing: { discountPercent: 0.1 },
        components: [
          { serviceId: { toString: () => "svc-1" }, spec: { durationMinutes: 60, headcount: 1, toolsMode: "provider", addOnIds: [] } },
          { serviceId: { toString: () => "svc-2" }, spec: { durationMinutes: 30, headcount: 1, toolsMode: "provider", addOnIds: [] } },
        ],
      },
    },
    slotStart: "2026-03-31T18:00:00.000Z",
    bookingRequestedAt: "2026-03-31T12:00:00.000Z",
    milesFromDepot: 5,
    jurisdiction: { taxRequired: false },
    organizationTimezone: "America/Los_Angeles",
  });

  assert.equal(quote.totals.laborSubtotal, 216);
  assert.equal(quote.itemizedLines[0].durationMinutes, 90);
  assert.equal(quote.itemizedLines[0].breakdown.components[1].breakdown.headcount, 2);
  assert.deepEqual(quote.itemizedLines[0].breakdown.components[1].breakdown.addOnIds, ["addon-1"]);
});

// ─── additional coverage tests ───────────────────────────────────────────────

test("calculateQuote rejects empty line items", () => {
  assert.throws(
    () =>
      calculateQuote({
        lineItems: [],
        servicesById: {},
        bundlesById: {},
        slotStart: "2026-03-31T18:00:00.000Z",
        bookingRequestedAt: "2026-03-31T12:00:00.000Z",
        milesFromDepot: 5,
        jurisdiction: {},
        organizationTimezone: "America/Los_Angeles",
      }),
    (err) => err.code === "INVALID_LINE_ITEMS",
  );
});

test("calculateQuote rejects invalid datetime inputs", () => {
  assert.throws(
    () =>
      calculateQuote({
        lineItems: [{ type: "service", serviceId: "s1", durationMinutes: 60 }],
        servicesById: { s1: { title: "t", pricing: { basePrice: 50 } } },
        bundlesById: {},
        slotStart: "not-a-date",
        bookingRequestedAt: "2026-03-31T12:00:00.000Z",
        milesFromDepot: 5,
        jurisdiction: {},
        organizationTimezone: "America/Los_Angeles",
      }),
    (err) => err.code === "INVALID_DATETIME",
  );
});

test("calculateQuote rejects negative miles", () => {
  assert.throws(
    () =>
      calculateQuote({
        lineItems: [{ type: "service", serviceId: "s1", durationMinutes: 60 }],
        servicesById: { s1: { title: "t", pricing: { basePrice: 50 } } },
        bundlesById: {},
        slotStart: "2026-03-31T18:00:00.000Z",
        bookingRequestedAt: "2026-03-31T12:00:00.000Z",
        milesFromDepot: -1,
        jurisdiction: {},
        organizationTimezone: "America/Los_Angeles",
      }),
    (err) => err.code === "INVALID_MILES",
  );
});

test("calculateQuote returns notServiceable when miles over 20", () => {
  const quote = calculateQuote({
    lineItems: [{ type: "service", serviceId: "s1", durationMinutes: 60 }],
    servicesById: { s1: { title: "t", pricing: { basePrice: 50 } } },
    bundlesById: {},
    slotStart: "2026-03-31T18:00:00.000Z",
    bookingRequestedAt: "2026-03-31T12:00:00.000Z",
    milesFromDepot: 25,
    jurisdiction: {},
    organizationTimezone: "America/Los_Angeles",
  });
  assert.equal(quote.notServiceable, true);
  assert.equal(quote.code, "OUT_OF_SERVICE_AREA");
  assert.equal(quote.travel.band, "over-20");
});

test("calculateQuote applies 10-20 miles travel fee", () => {
  const quote = calculateQuote({
    lineItems: [{ type: "service", serviceId: "s1", durationMinutes: 60 }],
    servicesById: { s1: { title: "t", pricing: { basePrice: 100 } } },
    bundlesById: {},
    slotStart: "2026-03-31T18:00:00.000Z",
    bookingRequestedAt: "2026-03-31T12:00:00.000Z",
    milesFromDepot: 15,
    jurisdiction: {},
    organizationTimezone: "America/Los_Angeles",
  });
  assert.equal(quote.totals.travelFee, 15);
  assert.equal(quote.travel.band, "10-20");
});

test("calculateQuote applies same-day surcharge when hoursUntilStart < 4 and sameDayPriority true", () => {
  const quote = calculateQuote({
    lineItems: [{ type: "service", serviceId: "s1", durationMinutes: 60 }],
    servicesById: { s1: { title: "t", pricing: { basePrice: 100 } } },
    bundlesById: {},
    slotStart: "2026-03-31T15:00:00.000Z",
    bookingRequestedAt: "2026-03-31T13:00:00.000Z",
    milesFromDepot: 5,
    jurisdiction: {},
    organizationTimezone: "America/Los_Angeles",
    sameDayPriority: true,
  });
  assert.equal(quote.totals.sameDaySurcharge, 25);
});

test("calculateQuote forces tax when jurisdiction taxRequired", () => {
  const quote = calculateQuote({
    lineItems: [{ type: "service", serviceId: "s1", durationMinutes: 60 }],
    servicesById: { s1: { title: "t", pricing: { basePrice: 100 } } },
    bundlesById: {},
    slotStart: "2026-03-31T18:00:00.000Z",
    bookingRequestedAt: "2026-03-31T12:00:00.000Z",
    milesFromDepot: 5,
    jurisdiction: { taxRequired: true, taxRate: 0.1 },
    organizationTimezone: "America/Los_Angeles",
    taxEnabled: true,
  });
  assert.equal(quote.jurisdiction.taxEnabled, true);
  assert.ok(quote.tax > 0);
});

test("calculateQuote rejects disabling tax in taxRequired jurisdiction", () => {
  assert.throws(
    () =>
      calculateQuote({
        lineItems: [{ type: "service", serviceId: "s1", durationMinutes: 60 }],
        servicesById: { s1: { title: "t", pricing: { basePrice: 100 } } },
        bundlesById: {},
        slotStart: "2026-03-31T18:00:00.000Z",
        bookingRequestedAt: "2026-03-31T12:00:00.000Z",
        milesFromDepot: 5,
        jurisdiction: { taxRequired: true, taxRate: 0.1 },
        organizationTimezone: "America/Los_Angeles",
        taxEnabled: false,
      }),
    (err) => err.code === "INVALID_TAX_OVERRIDE",
  );
});

test("calculateQuote rejects unknown service reference", () => {
  assert.throws(
    () =>
      calculateQuote({
        lineItems: [{ type: "service", serviceId: "missing", durationMinutes: 60 }],
        servicesById: {},
        bundlesById: {},
        slotStart: "2026-03-31T18:00:00.000Z",
        bookingRequestedAt: "2026-03-31T12:00:00.000Z",
        milesFromDepot: 5,
        jurisdiction: {},
        organizationTimezone: "America/Los_Angeles",
      }),
    (err) => err.code === "SERVICE_NOT_FOUND",
  );
});

test("calculateQuote rejects unknown bundle reference", () => {
  assert.throws(
    () =>
      calculateQuote({
        lineItems: [{ type: "bundle", bundleId: "missing", quantity: 1, specs: [] }],
        servicesById: {},
        bundlesById: {},
        slotStart: "2026-03-31T18:00:00.000Z",
        bookingRequestedAt: "2026-03-31T12:00:00.000Z",
        milesFromDepot: 5,
        jurisdiction: {},
        organizationTimezone: "America/Los_Angeles",
      }),
    (err) => err.code === "BUNDLE_NOT_FOUND",
  );
});

test("calculateQuote rejects invalid line item type", () => {
  assert.throws(
    () =>
      calculateQuote({
        lineItems: [{ type: "mystery" }],
        servicesById: {},
        bundlesById: {},
        slotStart: "2026-03-31T18:00:00.000Z",
        bookingRequestedAt: "2026-03-31T12:00:00.000Z",
        milesFromDepot: 5,
        jurisdiction: {},
        organizationTimezone: "America/Los_Angeles",
      }),
    (err) => err.code === "INVALID_LINE_TYPE",
  );
});

test("calculateQuote rejects non-object line item", () => {
  assert.throws(
    () =>
      calculateQuote({
        lineItems: ["oops"],
        servicesById: {},
        bundlesById: {},
        slotStart: "2026-03-31T18:00:00.000Z",
        bookingRequestedAt: "2026-03-31T12:00:00.000Z",
        milesFromDepot: 5,
        jurisdiction: {},
        organizationTimezone: "America/Los_Angeles",
      }),
    (err) => err.code === "INVALID_LINE_ITEM",
  );
});

test("calculateQuote rejects service with invalid duration", () => {
  assert.throws(
    () =>
      calculateQuote({
        lineItems: [{ type: "service", serviceId: "s1", durationMinutes: 45 }],
        servicesById: { s1: { title: "t", pricing: { basePrice: 100 } } },
        bundlesById: {},
        slotStart: "2026-03-31T18:00:00.000Z",
        bookingRequestedAt: "2026-03-31T12:00:00.000Z",
        milesFromDepot: 5,
        jurisdiction: {},
        organizationTimezone: "America/Los_Angeles",
      }),
    (err) => err.code === "INVALID_DURATION",
  );
});
