const test = require("node:test");
const assert = require("node:assert/strict");

const { getDeviceFingerprint } = require("./deviceFingerprintService");

test("getDeviceFingerprint prefers x-device-id header", () => {
  const req = {
    headers: {
      "user-agent": "agent-a",
      "x-device-id": "device-a",
      cookie: "device_id=device-cookie",
    },
  };

  const headerFingerprint = getDeviceFingerprint(req);
  const cookieFingerprint = getDeviceFingerprint({ headers: { "user-agent": "agent-a", cookie: "device_id=device-cookie" } });

  assert.notEqual(headerFingerprint, cookieFingerprint);
});

test("getDeviceFingerprint falls back to cookie and stable unknown defaults", () => {
  const cookieFingerprintA = getDeviceFingerprint({ headers: { cookie: "device_id=device-cookie" } });
  const cookieFingerprintB = getDeviceFingerprint({ headers: { cookie: "session=x; device_id=device-cookie" } });
  const unknownFingerprint = getDeviceFingerprint({ headers: {} });

  assert.equal(cookieFingerprintA, cookieFingerprintB);
  assert.equal(typeof unknownFingerprint, "string");
  assert.equal(unknownFingerprint.length, 64);
});
