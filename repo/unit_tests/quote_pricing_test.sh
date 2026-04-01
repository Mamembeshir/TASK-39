#!/bin/sh

node -e '
const { calculateQuote } = require("./backend/src/pricing");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertApprox(actual, expected, delta, message) {
  if (Math.abs(actual - expected) > delta) {
    throw new Error(`${message}. expected=${expected}, actual=${actual}`);
  }
}

const servicesById = {
  s1: {
    _id: "s1",
    title: "Service One",
    pricing: { basePrice: 80, durationAdjustments: { 30: 0, 60: 45, 90: 90 } },
  },
  s2: {
    _id: "s2",
    title: "Service Two",
    pricing: { basePrice: 70, durationAdjustments: { 30: 0, 60: 40, 90: 85 } },
  },
};

const bundlesById = {
  b1: {
    _id: "b1",
    title: "Bundle",
    serviceIds: ["s1", "s2"],
    pricing: { discountPercent: 0.1 },
  },
};

const taxOn = { _id: "US-CA-SF", taxRequired: true, taxRate: 0.0875 };
const taxOff = { _id: "US-OR-PDX", taxRequired: false, taxRate: 0 };

const timezone = "America/Los_Angeles";

// Scenario 1: travel 0-10 band => fee 0
{
  const quote = calculateQuote({
    lineItems: [{ type: "service", serviceId: "s1", durationMinutes: 30, quantity: 1 }],
    servicesById,
    bundlesById,
    slotStart: "2026-03-29T18:00:00.000Z",
    bookingRequestedAt: "2026-03-29T10:00:00.000Z",
    milesFromDepot: 5,
    jurisdiction: taxOff,
    organizationTimezone: timezone,
  });
  assert(quote.travel.fee === 0, "travel fee should be 0 for <=10 miles");
}

// Scenario 2: travel 10-20 band => fee 15
{
  const quote = calculateQuote({
    lineItems: [{ type: "service", serviceId: "s1", durationMinutes: 30, quantity: 1 }],
    servicesById,
    bundlesById,
    slotStart: "2026-03-29T18:00:00.000Z",
    bookingRequestedAt: "2026-03-29T10:00:00.000Z",
    milesFromDepot: 15,
    jurisdiction: taxOff,
    organizationTimezone: timezone,
  });
  assert(quote.travel.fee === 15, "travel fee should be 15 for >10 and <=20 miles");
}

// Scenario 3: >20 miles => not serviceable
{
  const quote = calculateQuote({
    lineItems: [{ type: "service", serviceId: "s1", durationMinutes: 30, quantity: 1 }],
    servicesById,
    bundlesById,
    slotStart: "2026-03-29T18:00:00.000Z",
    bookingRequestedAt: "2026-03-29T10:00:00.000Z",
    milesFromDepot: 25,
    jurisdiction: taxOff,
    organizationTimezone: timezone,
  });
  assert(quote.notServiceable === true, "quote should be not serviceable when >20 miles");
}

// Scenario 4: same-day boundary at 3h59 + priority selected => surcharge applies
{
  const quote = calculateQuote({
    lineItems: [{ type: "service", serviceId: "s1", durationMinutes: 30, quantity: 1 }],
    servicesById,
    bundlesById,
    slotStart: "2026-03-29T18:00:00.000Z",
    bookingRequestedAt: "2026-03-29T14:01:00.000Z",
    milesFromDepot: 5,
    jurisdiction: taxOff,
    organizationTimezone: timezone,
    sameDayPriority: true,
  });
  assert(quote.totals.sameDaySurcharge === 25, "same-day surcharge should apply at 3h59");
}

// Scenario 5: same-day boundary at 3h59 + priority not selected => surcharge does not apply
{
  const quote = calculateQuote({
    lineItems: [{ type: "service", serviceId: "s1", durationMinutes: 30, quantity: 1 }],
    servicesById,
    bundlesById,
    slotStart: "2026-03-29T18:00:00.000Z",
    bookingRequestedAt: "2026-03-29T14:01:00.000Z",
    milesFromDepot: 5,
    jurisdiction: taxOff,
    organizationTimezone: timezone,
  });
  assert(quote.totals.sameDaySurcharge === 0, "same-day surcharge should not apply when priority is not selected");
}

// Scenario 6: same-day boundary at 4h01 + priority selected => surcharge does not apply
{
  const quote = calculateQuote({
    lineItems: [{ type: "service", serviceId: "s1", durationMinutes: 30, quantity: 1 }],
    servicesById,
    bundlesById,
    slotStart: "2026-03-29T18:00:00.000Z",
    bookingRequestedAt: "2026-03-29T13:59:00.000Z",
    milesFromDepot: 5,
    jurisdiction: taxOff,
    organizationTimezone: timezone,
    sameDayPriority: true,
  });
  assert(quote.totals.sameDaySurcharge === 0, "same-day surcharge should not apply at 4h01");
}

// Scenario 7: after-hours edge (18:30 local, 60m) => 30 minutes after-hours
{
  const quote = calculateQuote({
    lineItems: [{ type: "service", serviceId: "s1", durationMinutes: 60, quantity: 1 }],
    servicesById,
    bundlesById,
    slotStart: "2026-03-30T01:30:00.000Z",
    bookingRequestedAt: "2026-03-29T10:00:00.000Z",
    milesFromDepot: 5,
    jurisdiction: taxOff,
    organizationTimezone: timezone,
  });
  assert(quote.timing.afterHoursMinutes === 30, "after-hours minutes should equal 30");
  assertApprox(quote.totals.afterHoursSurcharge, 31.25, 0.01, "after-hours surcharge should match expected value");
}

// Scenario 8: tax required jurisdiction applies tax
{
  const quote = calculateQuote({
    lineItems: [{ type: "service", serviceId: "s1", durationMinutes: 30, quantity: 1 }],
    servicesById,
    bundlesById,
    slotStart: "2026-03-29T18:00:00.000Z",
    bookingRequestedAt: "2026-03-29T10:00:00.000Z",
    milesFromDepot: 10,
    jurisdiction: taxOn,
    organizationTimezone: timezone,
  });
  assertApprox(quote.totals.tax, 7, 0.01, "tax should be applied when jurisdiction requires tax");
}

// Scenario 9: tax not required jurisdiction returns zero tax
{
  const quote = calculateQuote({
    lineItems: [{ type: "service", serviceId: "s1", durationMinutes: 30, quantity: 1 }],
    servicesById,
    bundlesById,
    slotStart: "2026-03-29T18:00:00.000Z",
    bookingRequestedAt: "2026-03-29T10:00:00.000Z",
    milesFromDepot: 10,
    jurisdiction: taxOff,
    organizationTimezone: timezone,
  });
  assert(quote.totals.tax === 0, "tax should be zero when jurisdiction does not require tax");
}

// Scenario 10: required-tax jurisdiction rejects disabling tax
{
  let threw = false;
  try {
    calculateQuote({
      lineItems: [{ type: "service", serviceId: "s1", durationMinutes: 30, quantity: 1 }],
      servicesById,
      bundlesById,
      slotStart: "2026-03-29T18:00:00.000Z",
      bookingRequestedAt: "2026-03-29T10:00:00.000Z",
      milesFromDepot: 10,
      jurisdiction: taxOn,
      organizationTimezone: timezone,
      taxEnabled: false,
    });
  } catch (error) {
    threw = true;
    assert(error.code === "INVALID_TAX_OVERRIDE", "tax override should fail with INVALID_TAX_OVERRIDE");
  }
  assert(threw, "required-tax jurisdiction should reject taxEnabled=false");
}
'
