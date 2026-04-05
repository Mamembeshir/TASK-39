const crypto = require("crypto");

function toCanonicalQuotePayload(quote) {
  return {
    itemizedLines: (quote.itemizedLines || []).map((line) => ({
      type: line.type,
      serviceId: line.serviceId || null,
      bundleId: line.bundleId || null,
      quantity: line.quantity,
      durationMinutes: line.durationMinutes,
      unitPrice: line.unitPrice,
      lineTotal: line.lineTotal,
    })),
    travel: quote.travel,
    totals: quote.totals,
    jurisdiction: quote.jurisdiction,
    notServiceable: quote.notServiceable,
    code: quote.code,
  };
}

function createQuoteSignature(quote) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(toCanonicalQuotePayload(quote)))
    .digest("hex");
}

function createQuoteService({ calculateQuote, createError, getDatabase, parseObjectIdOrNull }) {
  return {
    buildQuoteFromRequestPayload: async ({
      lineItems,
      slotStart,
      bookingRequestedAt,
      milesFromDepot,
      jurisdictionId,
      sameDayPriority,
      taxEnabled,
    }) => {
      if (!jurisdictionId || typeof jurisdictionId !== "string") {
        throw createError(400, "INVALID_JURISDICTION", "jurisdictionId is required");
      }

      const database = getDatabase();
      const serviceIds = [];
      const bundleIds = [];

      for (const line of lineItems || []) {
        if (line?.type === "service" && line.serviceId) {
          serviceIds.push(line.serviceId);
        }
        if (line?.type === "bundle" && line.bundleId) {
          bundleIds.push(line.bundleId);
        }
        if (line?.type === "bundle" && Array.isArray(line.specs)) {
          for (const spec of line.specs) {
            if (spec?.serviceId) {
              serviceIds.push(spec.serviceId);
            }
          }
        }
      }

      const uniqueBundleIds = [...new Set(bundleIds)].map((id) => parseObjectIdOrNull(id)).filter(Boolean);

      const [bundles, jurisdiction, settings] = await Promise.all([
        uniqueBundleIds.length > 0
          ? database.collection("bundles").find({ _id: { $in: uniqueBundleIds }, published: true }).toArray()
          : [],
        database.collection("jurisdictions").findOne({ _id: jurisdictionId }),
        database.collection("settings").findOne({}),
      ]);

      if (!jurisdiction) {
        throw createError(400, "INVALID_JURISDICTION", "Jurisdiction was not found");
      }

      for (const bundle of bundles) {
        for (const component of bundle.components || []) {
          if (component?.serviceId) {
            serviceIds.push(component.serviceId.toString());
          }
        }
        for (const serviceId of bundle.serviceIds || []) {
          serviceIds.push(serviceId.toString());
        }
      }

      const uniqueServiceIds = [...new Set(serviceIds)].map((id) => parseObjectIdOrNull(id)).filter(Boolean);
      const services = uniqueServiceIds.length > 0
        ? await database.collection("services").find({ _id: { $in: uniqueServiceIds }, published: true }).toArray()
        : [];

      const servicesById = Object.fromEntries(services.map((service) => [service._id.toString(), service]));
      const bundlesById = Object.fromEntries(bundles.map((bundle) => [bundle._id.toString(), bundle]));

      const serverBookingRequestedAt = new Date();
      if (bookingRequestedAt) {
        const requestedAt = new Date(bookingRequestedAt);
        if (Number.isNaN(requestedAt.getTime())) {
          throw createError(400, "INVALID_BOOKING_REQUESTED_AT", "bookingRequestedAt must be a valid ISO datetime");
        }
      }

      try {
        return calculateQuote({
          lineItems,
          servicesById,
          bundlesById,
          slotStart,
          bookingRequestedAt: serverBookingRequestedAt.toISOString(),
          milesFromDepot: Number(milesFromDepot),
          jurisdiction,
          organizationTimezone: settings?.organizationTimezone || "America/Los_Angeles",
          sameDayPriority: Boolean(sameDayPriority),
          taxEnabled,
        });
      } catch (error) {
        throw createError(400, error.code || "INVALID_QUOTE", error.message);
      }
    },
  };
}

module.exports = {
  createQuoteService,
  createQuoteSignature,
};
