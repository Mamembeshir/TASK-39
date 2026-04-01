const { getBundleComponents } = require("../../repositories/bundleRepository");

function normalizeBundleComponentSpecs(spec = {}) {
  return {
    durationMinutes: spec.durationMinutes ?? null,
    headcount: spec.headcount ?? null,
    toolsMode: spec.toolsMode ?? null,
    addOnIds: Array.isArray(spec.addOnIds) ? spec.addOnIds : [],
  };
}

function buildBundleComponentSelections(bundle, lineSpecs = []) {
  const components = getBundleComponents(bundle);
  const selectionsByServiceId = new Map(
    (Array.isArray(lineSpecs) ? lineSpecs : [])
      .filter((item) => item?.serviceId)
      .map((item) => [String(item.serviceId), item]),
  );

  return components.map((component) => {
    const serviceId = component.serviceId.toString();
    const defaults = normalizeBundleComponentSpecs(component.spec || {});
    const selection = selectionsByServiceId.get(serviceId) || {};

    return {
      serviceId,
      durationMinutes: selection.durationMinutes ?? defaults.durationMinutes,
      spec: {
        headcount: selection.headcount ?? defaults.headcount,
        toolsMode: selection.toolsMode ?? defaults.toolsMode,
        addOnIds: Array.isArray(selection.addOnIds) ? selection.addOnIds : defaults.addOnIds,
      },
    };
  });
}

module.exports = {
  buildBundleComponentSelections,
  normalizeBundleComponentSpecs,
};
