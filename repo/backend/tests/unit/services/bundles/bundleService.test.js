const test = require("node:test");
const assert = require("node:assert/strict");

const { buildBundleComponentSelections } = require("../../../../src/services/bundles/bundleService");
const { normalizeBundleComponentSpecs } = require("../../../../src/services/bundles/bundleService");

test("buildBundleComponentSelections merges bundle defaults with line overrides", () => {
  const bundle = {
    components: [
      {
        serviceId: { toString: () => "svc-a" },
        spec: { durationMinutes: 60, headcount: 2, toolsMode: "provider", addOnIds: ["soap"] },
      },
      {
        serviceId: { toString: () => "svc-b" },
        spec: { durationMinutes: 30, headcount: 1, toolsMode: "customer", addOnIds: [] },
      },
    ],
  };

  const selections = buildBundleComponentSelections(bundle, [
    { serviceId: "svc-a", durationMinutes: 90, addOnIds: ["ladder"] },
  ]);

  assert.deepEqual(selections, [
    {
      serviceId: "svc-a",
      durationMinutes: 90,
      spec: { headcount: 2, toolsMode: "provider", addOnIds: ["ladder"] },
    },
    {
      serviceId: "svc-b",
      durationMinutes: 30,
      spec: { headcount: 1, toolsMode: "customer", addOnIds: [] },
    },
  ]);
});

test("normalizeBundleComponentSpecs fills missing values safely", () => {
  assert.deepEqual(normalizeBundleComponentSpecs({}), {
    durationMinutes: null,
    headcount: null,
    toolsMode: null,
    addOnIds: [],
  });
});

test("buildBundleComponentSelections handles legacy bundles without line specs", () => {
  const selections = buildBundleComponentSelections(
    { serviceIds: [{ toString: () => "svc-a" }] },
    undefined,
  );

  assert.deepEqual(selections, [
    {
      serviceId: "svc-a",
      durationMinutes: null,
      spec: { headcount: null, toolsMode: null, addOnIds: [] },
    },
  ]);
});
