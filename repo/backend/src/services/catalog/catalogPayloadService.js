function createCatalogPayloadService({ parseObjectIdOrNull, validDurations, validToolsMode }) {
  function normalizeServicePayload(payload, { partial = false } = {}) {
    const errors = [];
    const doc = {};

    const requiredFields = [
      "title",
      "description",
      "category",
      "tags",
      "specDefinitions",
      "addOns",
      "bundleIds",
    ];
    if (!partial) {
      for (const field of requiredFields) {
        if (payload[field] === undefined) {
          errors.push(`${field} is required`);
        }
      }
    }

    if (payload.title !== undefined) {
      if (typeof payload.title !== "string" || payload.title.trim().length === 0) {
        errors.push("title must be a non-empty string");
      } else {
        doc.title = payload.title.trim();
      }
    }

    if (payload.description !== undefined) {
      if (typeof payload.description !== "string" || payload.description.trim().length === 0) {
        errors.push("description must be a non-empty string");
      } else {
        doc.description = payload.description.trim();
      }
    }

    if (payload.category !== undefined) {
      if (typeof payload.category !== "string" || payload.category.trim().length === 0) {
        errors.push("category must be a non-empty string");
      } else {
        doc.category = payload.category.trim();
      }
    }

    if (payload.tags !== undefined) {
      if (
        !Array.isArray(payload.tags) ||
        payload.tags.some((tag) => typeof tag !== "string" || tag.trim().length === 0)
      ) {
        errors.push("tags must be an array of non-empty strings");
      } else {
        doc.tags = payload.tags.map((tag) => tag.trim());
      }
    }

    if (payload.addOns !== undefined) {
      if (
        !Array.isArray(payload.addOns) ||
        payload.addOns.some((item) => typeof item !== "string" || item.trim().length === 0)
      ) {
        errors.push("addOns must be an array of non-empty strings");
      } else {
        doc.addOns = payload.addOns.map((item) => item.trim());
      }
    }

    if (payload.bundleIds !== undefined) {
      if (!Array.isArray(payload.bundleIds)) {
        errors.push("bundleIds must be an array");
      } else {
        const parsedBundleIds = payload.bundleIds.map((id) => parseObjectIdOrNull(id));
        if (parsedBundleIds.some((id) => !id)) {
          errors.push("bundleIds must contain valid ids");
        } else {
          doc.bundleIds = parsedBundleIds;
        }
      }
    }

    if (payload.published !== undefined) {
      if (typeof payload.published !== "boolean") {
        errors.push("published must be boolean");
      } else {
        doc.published = payload.published;
      }
    }

    if (payload.specDefinitions !== undefined) {
      const spec = payload.specDefinitions;
      if (!spec || typeof spec !== "object") {
        errors.push("specDefinitions must be an object");
      } else {
        const duration = Array.isArray(spec.durationMinutes) ? spec.durationMinutes : null;
        const headcount = Array.isArray(spec.headcount) ? spec.headcount : null;
        const toolsMode = Array.isArray(spec.toolsMode) ? spec.toolsMode : null;

        if (!duration || duration.some((value) => !validDurations.includes(value))) {
          errors.push("durationMinutes must contain only 30, 60, 90");
        }
        if (!headcount || headcount.some((value) => !Number.isInteger(value) || value < 1 || value > 4)) {
          errors.push("headcount must contain only integers from 1 to 4");
        }
        if (!toolsMode || toolsMode.some((value) => !validToolsMode.includes(value))) {
          errors.push("toolsMode must contain only provider or customer");
        }

        if (errors.length === 0) {
          doc.specDefinitions = {
            durationMinutes: duration,
            headcount,
            toolsMode,
          };
        }
      }
    }

    return {
      ok: errors.length === 0,
      errors,
      document: doc,
    };
  }

  function normalizeBundlePayload(payload, { partial = false } = {}) {
    const errors = [];
    const doc = {};

    const requiredFields = ["title", "description"];
    if (!partial) {
      for (const field of requiredFields) {
        if (payload[field] === undefined) {
          errors.push(`${field} is required`);
        }
      }
    }

    if (payload.title !== undefined) {
      if (typeof payload.title !== "string" || payload.title.trim().length === 0) {
        errors.push("title must be a non-empty string");
      } else {
        doc.title = payload.title.trim();
      }
    }

    if (payload.description !== undefined) {
      if (typeof payload.description !== "string" || payload.description.trim().length === 0) {
        errors.push("description must be a non-empty string");
      } else {
        doc.description = payload.description.trim();
      }
    }

    if (payload.components !== undefined) {
      if (!Array.isArray(payload.components) || payload.components.length === 0) {
        errors.push("components must be a non-empty array");
      } else {
        const parsedComponents = payload.components.map((component) => {
          const serviceId = parseObjectIdOrNull(component?.serviceId);
          if (!serviceId) {
            return null;
          }
          const normalizedAddOnIds = Array.isArray(component?.spec?.addOnIds)
            ? component.spec.addOnIds.map((id) => String(id).trim()).filter(Boolean)
            : [];
          const normalizedSpec = {
            durationMinutes:
              component?.spec?.durationMinutes === undefined ? null : Number(component.spec.durationMinutes),
            headcount: component?.spec?.headcount === undefined ? null : Number(component.spec.headcount),
            toolsMode: component?.spec?.toolsMode === undefined ? null : String(component.spec.toolsMode),
            addOnIds: normalizedAddOnIds,
          };

          if (
            normalizedSpec.durationMinutes !== null
            && ![30, 60, 90].includes(normalizedSpec.durationMinutes)
          ) {
            return { invalid: true };
          }
          if (
            normalizedSpec.headcount !== null
            && (!Number.isInteger(normalizedSpec.headcount) || normalizedSpec.headcount < 1)
          ) {
            return { invalid: true };
          }
          if (
            normalizedSpec.toolsMode !== null
            && !["provider", "customer"].includes(normalizedSpec.toolsMode)
          ) {
            return { invalid: true };
          }

          return {
            serviceId,
            spec: normalizedSpec,
          };
        });

        if (parsedComponents.some((component) => !component || component.invalid)) {
          errors.push("components must contain valid serviceId and optional spec defaults");
        } else {
          doc.components = parsedComponents;
          doc.serviceIds = [...new Map(parsedComponents.map((component) => [component.serviceId.toString(), component.serviceId])).values()];
        }
      }
    }

    if (payload.serviceIds !== undefined) {
      if (!Array.isArray(payload.serviceIds) || payload.serviceIds.length === 0) {
        errors.push("serviceIds must be a non-empty array");
      } else {
        const parsedServiceIds = payload.serviceIds.map((id) => parseObjectIdOrNull(id));
        if (parsedServiceIds.some((id) => !id)) {
          errors.push("serviceIds must contain valid ids");
        } else {
          doc.serviceIds = parsedServiceIds;
          if (doc.components === undefined) {
            doc.components = parsedServiceIds.map((serviceId) => ({
              serviceId,
              spec: {
                durationMinutes: null,
                headcount: null,
                toolsMode: null,
                addOnIds: [],
              },
            }));
          }
        }
      }
    }

    if (!partial && payload.components === undefined && payload.serviceIds === undefined) {
      errors.push("components or serviceIds is required");
    }

    if (payload.published !== undefined) {
      if (typeof payload.published !== "boolean") {
        errors.push("published must be boolean");
      } else {
        doc.published = payload.published;
      }
    }

    return {
      ok: errors.length === 0,
      errors,
      document: doc,
    };
  }

  return {
    normalizeBundlePayload,
    normalizeServicePayload,
  };
}

module.exports = {
  createCatalogPayloadService,
};
