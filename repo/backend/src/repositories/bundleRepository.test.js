const test = require("node:test");
const assert = require("node:assert/strict");

const { getBundleComponents, getBundleServiceIds } = require("./bundleRepository");

test("getBundleComponents prefers explicit components", () => {
  const bundle = {
    components: [{ serviceId: "svc-a" }, { serviceId: "svc-b" }],
    serviceIds: ["svc-c"],
  };

  assert.deepEqual(getBundleComponents(bundle), [{ serviceId: "svc-a" }, { serviceId: "svc-b" }]);
});

test("getBundleComponents falls back to legacy serviceIds", () => {
  assert.deepEqual(getBundleComponents({ serviceIds: ["svc-a", "svc-b"] }), [
    { serviceId: "svc-a" },
    { serviceId: "svc-b" },
  ]);
});

test("getBundleServiceIds filters nullish service ids", () => {
  assert.deepEqual(
    getBundleServiceIds({ components: [{ serviceId: "svc-a" }, { serviceId: null }, {}] }),
    ["svc-a"],
  );
});
