const test = require("node:test");
const assert = require("node:assert/strict");

const { calculateQuote } = require("./pricing");

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
