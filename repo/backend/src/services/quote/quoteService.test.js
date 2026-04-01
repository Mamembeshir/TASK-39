const test = require("node:test");
const assert = require("node:assert/strict");

const { createQuoteSignature } = require("./quoteService");

test("createQuoteSignature is stable for equivalent quotes regardless of breakdown fields", () => {
  const quoteA = {
    itemizedLines: [
      {
        type: "bundle",
        bundleId: "bundle-1",
        quantity: 1,
        durationMinutes: 90,
        unitPrice: 216,
        lineTotal: 216,
        breakdown: { ignored: true },
      },
    ],
    travel: { milesFromDepot: 5, band: "0-10", fee: 0 },
    totals: { laborSubtotal: 216, travelFee: 0, tax: 0, total: 216 },
    jurisdiction: { id: "US-OR-PDX", taxRequired: false, taxRate: 0 },
    notServiceable: false,
    code: "OK",
  };

  const quoteB = {
    ...quoteA,
    itemizedLines: [
      {
        ...quoteA.itemizedLines[0],
        breakdown: { different: "value" },
      },
    ],
  };

  assert.equal(createQuoteSignature(quoteA), createQuoteSignature(quoteB));
});

test("createQuoteSignature changes when priced fields change", () => {
  const quoteA = {
    itemizedLines: [{ type: "service", serviceId: "svc-1", quantity: 1, durationMinutes: 30, unitPrice: 80, lineTotal: 80 }],
    travel: { milesFromDepot: 5, band: "0-10", fee: 0 },
    totals: { laborSubtotal: 80, travelFee: 0, tax: 0, total: 80 },
    jurisdiction: { id: "US-OR-PDX", taxRequired: false, taxRate: 0 },
    notServiceable: false,
    code: "OK",
  };
  const quoteB = {
    ...quoteA,
    totals: { ...quoteA.totals, total: 95 },
  };

  assert.notEqual(createQuoteSignature(quoteA), createQuoteSignature(quoteB));
});
