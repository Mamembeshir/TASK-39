const test = require("node:test");
const assert = require("node:assert/strict");

const { assessLoginRisk } = require("./auditService");

test("new device with prior device history escalates risk", () => {
  const risk = assessLoginRisk({
    isNewDevice: true,
    knownDeviceCount: 2,
    recentFailureCount: 3,
    hasIpAddress: true,
    hasUserAgent: true,
  });

  assert.deepEqual(risk, {
    score: 85,
    category: "high",
    recommendedAction: "step_up",
  });
});

test("first known device stays low risk", () => {
  const risk = assessLoginRisk({
    isNewDevice: true,
    knownDeviceCount: 0,
    recentFailureCount: 0,
    hasIpAddress: true,
    hasUserAgent: true,
  });

  assert.deepEqual(risk, {
    score: 25,
    category: "low",
    recommendedAction: "allow",
  });
});

test("missing ip and user agent can elevate to medium risk", () => {
  const risk = assessLoginRisk({
    isNewDevice: true,
    knownDeviceCount: 0,
    recentFailureCount: 1,
    hasIpAddress: false,
    hasUserAgent: false,
  });

  assert.deepEqual(risk, {
    score: 50,
    category: "medium",
    recommendedAction: "notify",
  });
});

test("risk score is capped at 100", () => {
  const risk = assessLoginRisk({
    isNewDevice: true,
    knownDeviceCount: 10,
    recentFailureCount: 10,
    hasIpAddress: false,
    hasUserAgent: false,
  });

  assert.deepEqual(risk, {
    score: 100,
    category: "high",
    recommendedAction: "step_up",
  });
});
