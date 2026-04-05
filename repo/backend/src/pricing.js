const VALID_DURATIONS = [30, 60, 90];
const { buildBundleComponentSelections } = require("./services/bundles/bundleService");

function createPricingError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function parseMilesBand(milesFromDepot) {
  if (!Number.isFinite(milesFromDepot) || milesFromDepot < 0) {
    throw createPricingError("INVALID_MILES", "milesFromDepot must be a non-negative number");
  }

  if (milesFromDepot <= 10) {
    return { fee: 0, blocked: false, label: "0-10" };
  }
  if (milesFromDepot <= 20) {
    return { fee: 15, blocked: false, label: "10-20" };
  }
  return { fee: 0, blocked: true, label: "over-20" };
}

function getLocalHour(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    hour: "2-digit",
  });
  const hour = Number(formatter.format(date));
  return Number.isNaN(hour) ? 0 : hour;
}

function calculateAfterHoursMinutes(startDate, totalDurationMinutes, timeZone) {
  let afterHoursMinutes = 0;
  for (let i = 0; i < totalDurationMinutes; i += 1) {
    const current = new Date(startDate.getTime() + i * 60 * 1000);
    const hour = getLocalHour(current, timeZone);
    if (hour >= 19 || hour < 7) {
      afterHoursMinutes += 1;
    }
  }
  return afterHoursMinutes;
}

function calculateServiceLinePrice(service, durationMinutes, quantity = 1, serviceSpec = {}) {
  if (!VALID_DURATIONS.includes(durationMinutes)) {
    throw createPricingError("INVALID_DURATION", "durationMinutes must be one of 30, 60, 90");
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw createPricingError("INVALID_QUANTITY", "quantity must be a positive integer");
  }

  const validHeadcount = Array.isArray(service.specDefinitions?.headcount) ? service.specDefinitions.headcount : [1];
  const validToolsMode = Array.isArray(service.specDefinitions?.toolsMode) ? service.specDefinitions.toolsMode : ["provider"];
  const validAddOns = Array.isArray(service.addOns) ? service.addOns : [];
  const headcount = Number(serviceSpec.headcount ?? 1);
  const toolsMode = serviceSpec.toolsMode ?? "provider";
  const addOnIds = Array.isArray(serviceSpec.addOnIds) ? serviceSpec.addOnIds : [];

  if (!validHeadcount.includes(headcount)) {
    throw createPricingError("INVALID_HEADCOUNT", "Requested headcount is not available for this service");
  }
  if (!validToolsMode.includes(toolsMode)) {
    throw createPricingError("INVALID_TOOLS_MODE", "Requested tools mode is not available for this service");
  }
  if (addOnIds.some((addOnId) => !validAddOns.includes(addOnId))) {
    throw createPricingError("INVALID_ADD_ON", "Requested add-on is not available for this service");
  }

  const basePrice = Number(service.pricing?.basePrice ?? 0);
  const durationAdjustments = service.pricing?.durationAdjustments || {};
  const durationAdjustment = Number(durationAdjustments[String(durationMinutes)] ?? 0);
  const coreUnitPrice = basePrice + durationAdjustment;
  const headcountAdjustment = headcount > 1 ? coreUnitPrice * 0.6 * (headcount - 1) : 0;
  const toolsAdjustment = toolsMode === "customer" ? -8 : 0;
  const addOnsAdjustment = addOnIds.length * 12;
  const unitPrice = Math.max(0, coreUnitPrice + headcountAdjustment + toolsAdjustment + addOnsAdjustment);
  const lineTotal = unitPrice * quantity;

  return {
    lineTotal,
    unitPrice,
    quantity,
    durationMinutes,
    breakdown: {
      basePrice,
      durationAdjustment,
      headcount,
      headcountAdjustment,
      toolsMode,
      toolsAdjustment,
      addOnIds,
      addOnsAdjustment,
    },
  };
}

function calculateQuote({
  lineItems,
  servicesById,
  bundlesById,
  slotStart,
  bookingRequestedAt,
  milesFromDepot,
  jurisdiction,
  organizationTimezone,
  sameDayPriority,
  taxEnabled,
}) {
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    throw createPricingError("INVALID_LINE_ITEMS", "lineItems must be a non-empty array");
  }

  const slotStartDate = new Date(slotStart);
  const bookingRequestedDate = new Date(bookingRequestedAt);
  if (Number.isNaN(slotStartDate.getTime()) || Number.isNaN(bookingRequestedDate.getTime())) {
    throw createPricingError(
      "INVALID_DATETIME",
      "slotStart and bookingRequestedAt must be valid ISO strings",
    );
  }

  const travelBand = parseMilesBand(milesFromDepot);
  if (travelBand.blocked) {
    return {
      notServiceable: true,
      code: "OUT_OF_SERVICE_AREA",
      travel: {
        milesFromDepot,
        band: travelBand.label,
        fee: 0,
      },
      totals: {
        laborSubtotal: 0,
        travelFee: 0,
        sameDaySurcharge: 0,
        afterHoursSurcharge: 0,
        tax: 0,
        total: 0,
      },
      itemizedLines: [],
    };
  }

  const itemizedLines = [];
  let laborSubtotal = 0;
  let totalDurationMinutes = 0;

  for (const line of lineItems) {
    if (!line || typeof line !== "object") {
      throw createPricingError("INVALID_LINE_ITEM", "Each line item must be an object");
    }

    if (line.type === "service") {
      const service = servicesById[line.serviceId];
      if (!service) {
        throw createPricingError("SERVICE_NOT_FOUND", `Service ${line.serviceId} was not found`);
      }

        const priced = calculateServiceLinePrice(
          service,
          Number(line.durationMinutes),
          Number(line.quantity || 1),
          line.spec,
        );
      laborSubtotal += priced.lineTotal;
      totalDurationMinutes += priced.durationMinutes * priced.quantity;
      itemizedLines.push({
        type: "service",
        serviceId: line.serviceId,
        title: service.title,
        ...priced,
      });
      continue;
    }

    if (line.type === "bundle") {
      const bundle = bundlesById[line.bundleId];
      if (!bundle) {
        throw createPricingError("BUNDLE_NOT_FOUND", `Bundle ${line.bundleId} was not found`);
      }

      const bundleQuantity = Number(line.quantity || 1);
      if (!Number.isInteger(bundleQuantity) || bundleQuantity < 1) {
        throw createPricingError("INVALID_QUANTITY", "quantity must be a positive integer");
      }

      const bundleComponents = buildBundleComponentSelections(bundle, line.specs);
      let bundleUnitTotal = 0;
      let bundleDuration = 0;
      const pricedComponents = [];

      for (const componentSelection of bundleComponents) {
        const serviceId = componentSelection.serviceId;
        if (!componentSelection.durationMinutes) {
          throw createPricingError("INVALID_BUNDLE_SPECS", `Bundle spec missing duration for service ${serviceId}`);
        }
        const service = servicesById[serviceId];
        if (!service) {
          throw createPricingError("SERVICE_NOT_FOUND", `Service ${serviceId} was not found`);
        }

        const component = calculateServiceLinePrice(
          service,
          Number(componentSelection.durationMinutes),
          1,
          componentSelection.spec,
        );
        bundleUnitTotal += component.lineTotal;
        bundleDuration += component.durationMinutes;
        pricedComponents.push({
          serviceId,
          title: service.title,
          ...component,
        });
      }

      const discountPercent = Number(bundle.pricing?.discountPercent ?? 0);
      const discountValue = bundleUnitTotal * discountPercent;
      const discountedUnitTotal = bundleUnitTotal - discountValue;
      const lineTotal = discountedUnitTotal * bundleQuantity;

      laborSubtotal += lineTotal;
      totalDurationMinutes += bundleDuration * bundleQuantity;

      itemizedLines.push({
        type: "bundle",
        bundleId: line.bundleId,
        title: bundle.title,
        quantity: bundleQuantity,
        durationMinutes: bundleDuration,
        unitPrice: discountedUnitTotal,
        lineTotal,
        breakdown: {
          baseBundlePrice: bundleUnitTotal,
          discountPercent,
          discountValue,
          components: pricedComponents,
        },
      });
      continue;
    }

    throw createPricingError("INVALID_LINE_TYPE", "line item type must be service or bundle");
  }

  const travelFee = travelBand.fee;
  const hoursUntilStart = (slotStartDate.getTime() - bookingRequestedDate.getTime()) / (60 * 60 * 1000);
  const sameDaySurcharge = sameDayPriority && hoursUntilStart < 4 ? 25 : 0;

  const afterHoursMinutes = calculateAfterHoursMinutes(
    slotStartDate,
    totalDurationMinutes,
    organizationTimezone,
  );
  const perMinuteLabor = totalDurationMinutes > 0 ? laborSubtotal / totalDurationMinutes : 0;
  const afterHoursSurcharge = perMinuteLabor * afterHoursMinutes * 0.5;

  const subtotalBeforeTax = laborSubtotal + travelFee + sameDaySurcharge + afterHoursSurcharge;
  if (jurisdiction?.taxRequired && taxEnabled === false) {
    throw createPricingError("INVALID_TAX_OVERRIDE", "tax cannot be disabled for this jurisdiction");
  }
  const effectiveTaxEnabled = jurisdiction?.taxRequired ? true : Boolean(taxEnabled);
  const taxRate = effectiveTaxEnabled ? Number(jurisdiction?.taxRate || 0) : 0;
  const tax = subtotalBeforeTax * taxRate;
  const total = subtotalBeforeTax + tax;
  const taxBreakdown = [
    { label: "Subtotal", amount: subtotalBeforeTax },
    { label: "Tax", amount: tax },
  ];
  const normalizedLineItems = itemizedLines.map((line) => ({
    serviceId: line.serviceId,
    bundleId: line.bundleId,
    amount: Number(line.lineTotal || 0),
  }));

  return {
    notServiceable: false,
    code: "OK",
    itemizedLines,
    lineItems: normalizedLineItems,
    subtotal: subtotalBeforeTax,
    tax,
    travelFee,
    sameDaySurcharge,
    total,
    taxBreakdown,
    travel: {
      milesFromDepot,
      band: travelBand.label,
      fee: travelFee,
    },
    timing: {
      organizationTimezone,
      afterHoursMinutes,
      totalDurationMinutes,
    },
    totals: {
      laborSubtotal,
      travelFee,
      sameDaySurcharge,
      afterHoursSurcharge,
      subtotalBeforeTax,
      tax,
      total,
    },
    jurisdiction: {
      id: jurisdiction?._id || null,
      taxRequired: Boolean(jurisdiction?.taxRequired),
      taxEnabled: effectiveTaxEnabled,
      taxRate,
    },
  };
}

module.exports = {
  VALID_DURATIONS,
  calculateQuote,
};
