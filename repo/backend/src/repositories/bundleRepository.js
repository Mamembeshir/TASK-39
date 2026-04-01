function getBundleComponents(bundle) {
  if (!bundle || typeof bundle !== "object") {
    return [];
  }

  if (Array.isArray(bundle.components) && bundle.components.length > 0) {
    return bundle.components;
  }

  return (bundle.serviceIds || []).map((serviceId) => ({ serviceId }));
}

function getBundleServiceIds(bundle) {
  return getBundleComponents(bundle)
    .map((component) => component?.serviceId)
    .filter(Boolean);
}

module.exports = {
  getBundleComponents,
  getBundleServiceIds,
};
