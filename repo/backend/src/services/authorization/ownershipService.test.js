const test = require("node:test");
const assert = require("node:assert/strict");

const {
  assertCanAccessOrder,
  assertCanAccessTicket,
  assertCanSubmitReviewForOrder,
} = require("./ownershipService");

function assertNotFound(fn) {
  assert.throws(fn, (error) => error && error.status === 404 && error.code === "NOT_FOUND");
}

test("assertCanAccessOrder allows matching customer and staff", () => {
  const order = { customerId: { toString: () => "user-1" } };
  assert.doesNotThrow(() => assertCanAccessOrder({ userId: "user-1", roles: ["customer"] }, order));
  assert.doesNotThrow(() => assertCanAccessOrder({ userId: "other", roles: ["administrator"] }, order));
});

test("assertCanAccessOrder hides missing or unauthorized orders as not found", () => {
  assertNotFound(() => assertCanAccessOrder({ userId: "user-1", roles: ["customer"] }, null));
  assertNotFound(() => assertCanAccessOrder({ userId: "user-2", roles: ["customer"] }, { customerId: { toString: () => "user-1" } }));
});

test("assertCanAccessTicket allows matching customer and staff", () => {
  const ticket = { customerId: { toString: () => "user-1" } };
  assert.doesNotThrow(() => assertCanAccessTicket({ sub: "user-1", roles: ["customer"] }, ticket));
  assert.doesNotThrow(() => assertCanAccessTicket({ sub: "other", roles: ["service_manager"] }, ticket));
  assert.doesNotThrow(() => assertCanAccessTicket({ sub: "other", roles: ["moderator"] }, ticket));
});

test("assertCanAccessTicket hides unauthorized tickets as not found", () => {
  assertNotFound(() => assertCanAccessTicket({ sub: "user-2", roles: ["customer"] }, { customerId: { toString: () => "user-1" } }));
});

test("assertCanSubmitReviewForOrder only allows owning customer", () => {
  const order = { customerId: { toString: () => "user-1" } };
  assert.doesNotThrow(() => assertCanSubmitReviewForOrder({ userId: "user-1", roles: ["customer"] }, order));
  assertNotFound(() => assertCanSubmitReviewForOrder({ userId: "user-2", roles: ["customer"] }, order));
});
