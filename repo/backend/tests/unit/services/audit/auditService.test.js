const test = require("node:test");
const assert = require("node:assert/strict");

const { assessLoginRisk, createAuditService } = require("../../../../src/services/audit/auditService");

function makeFakeDb() {
  const calls = [];
  return {
    calls,
    db: {
      collection: (name) => ({
        insertOne: async (doc) => { calls.push({ name, doc }); return { insertedId: "x" }; },
      }),
    },
  };
}

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

test("writeAuditLog inserts expected envelope", async () => {
  const fake = makeFakeDb();
  const svc = createAuditService({ getDatabase: () => fake.db, getClientIp: (r) => r.ip || null });
  await svc.writeAuditLog({
    username: "demo",
    userId: "uid",
    action: "auth.login",
    outcome: "success",
    req: { headers: { "user-agent": "UA" }, ip: "1.1.1.1" },
  });
  assert.equal(fake.calls.length, 1);
  const { name, doc } = fake.calls[0];
  assert.equal(name, "audit_logs");
  assert.equal(doc.action, "auth.login");
  assert.equal(doc.who, "uid");
  assert.equal(doc.metadata.username, "demo");
  assert.equal(doc.metadata.ip, "1.1.1.1");
  assert.equal(doc.metadata.userAgent, "UA");
  assert.ok(doc.createdAt instanceof Date);
});

test("writeAuditLog handles missing req and userId", async () => {
  const fake = makeFakeDb();
  const svc = createAuditService({ getDatabase: () => fake.db, getClientIp: () => null });
  await svc.writeAuditLog({ action: "a", outcome: "o" });
  assert.equal(fake.calls.length, 1);
  const { doc } = fake.calls[0];
  assert.equal(doc.who, null);
  assert.equal(doc.metadata.username, null);
  assert.equal(doc.metadata.userAgent, "unknown");
});

test("writeAuditLog includes details object when provided", async () => {
  const fake = makeFakeDb();
  const svc = createAuditService({ getDatabase: () => fake.db, getClientIp: () => "x" });
  await svc.writeAuditLog({ action: "a", outcome: "o", details: { foo: 1 } });
  assert.deepEqual(fake.calls[0].doc.metadata.details, { foo: 1 });
});

test("writeAuditLog skips non-object details", async () => {
  const fake = makeFakeDb();
  const svc = createAuditService({ getDatabase: () => fake.db, getClientIp: () => "x" });
  await svc.writeAuditLog({ action: "a", outcome: "o", details: "not-an-object" });
  assert.equal(fake.calls[0].doc.metadata.details, undefined);
});

test("writeAuditLog swallows database errors", async () => {
  const svc = createAuditService({
    getDatabase: () => ({ collection: () => ({ insertOne: async () => { throw new Error("db"); } }) }),
    getClientIp: () => null,
  });
  await assert.doesNotReject(() => svc.writeAuditLog({ action: "a", outcome: "o" }));
});

test("createAuditService exposes assessLoginRisk", () => {
  const svc = createAuditService({ getDatabase: () => ({}), getClientIp: () => null });
  assert.equal(typeof svc.assessLoginRisk, "function");
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
