const test = require("node:test");
const assert = require("node:assert/strict");

const { createCatalogPayloadService } = require("./catalogPayloadService");

const payloadService = createCatalogPayloadService({
  parseObjectIdOrNull: (value) => {
    const normalized = String(value || "").trim();
    return /^[a-f0-9]{24}$/i.test(normalized) ? { toString: () => normalized } : null;
  },
  validDurations: [30, 60, 90],
  validToolsMode: ["provider", "customer"],
});

test("normalizeServicePayload accepts valid service payloads", () => {
  const result = payloadService.normalizeServicePayload({
    title: " Test ",
    description: " Desc ",
    category: "care",
    tags: ["a", "b"],
    addOns: ["x"],
    bundleIds: ["65f000000000000000000201"],
    published: true,
    specDefinitions: {
      durationMinutes: [30, 60],
      headcount: [1, 2],
      toolsMode: ["provider", "customer"],
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.document.title, "Test");
  assert.equal(result.document.description, "Desc");
  assert.equal(result.document.bundleIds[0].toString(), "65f000000000000000000201");
});

test("normalizeServicePayload rejects invalid spec definitions", () => {
  const result = payloadService.normalizeServicePayload({
    title: "Test",
    description: "Desc",
    category: "care",
    tags: ["a"],
    addOns: ["x"],
    bundleIds: [],
    specDefinitions: {
      durationMinutes: [45],
      headcount: [0],
      toolsMode: ["invalid"],
    },
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, [
    "durationMinutes must contain only 30, 60, 90",
    "headcount must contain only integers from 1 to 4",
    "toolsMode must contain only provider or customer",
  ]);
});

test("normalizeBundlePayload builds legacy components from serviceIds", () => {
  const result = payloadService.normalizeBundlePayload({
    title: "Bundle",
    description: "Desc",
    serviceIds: ["65f000000000000000000101", "65f000000000000000000102"],
  });

  assert.equal(result.ok, true);
  assert.equal(result.document.components.length, 2);
  assert.deepEqual(result.document.components[0].spec, {
    durationMinutes: null,
    headcount: null,
    toolsMode: null,
    addOnIds: [],
  });
});

test("normalizeBundlePayload rejects invalid component defaults", () => {
  const result = payloadService.normalizeBundlePayload({
    title: "Bundle",
    description: "Desc",
    components: [{ serviceId: "65f000000000000000000101", spec: { durationMinutes: 45 } }],
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, ["components must contain valid serviceId and optional spec defaults"]);
});
