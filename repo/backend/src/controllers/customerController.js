function createCustomerController(deps) {
  const {
    buildQuoteFromRequestPayload,
    createError,
    createQuoteSignature,
    decryptField,
    encryptField,
    getDatabase,
    hasRole,
    maskAddress,
    maskPhone,
    ObjectId,
    STAFF_ROLES,
    parseObjectIdOrNull,
  } = deps;

  return {
    updateProfileContact: async (req, res, next) => {
      try {
        const { phone, address } = req.body || {};
        if (phone !== undefined && typeof phone !== "string") {
          return next(createError(400, "INVALID_PHONE", "phone must be a string"));
        }
        if (address !== undefined && typeof address !== "string") {
          return next(createError(400, "INVALID_ADDRESS", "address must be a string"));
        }

        const updates = { updatedAt: new Date() };
        if (phone !== undefined) {
          updates.phoneEncrypted = encryptField(phone);
        }
        if (address !== undefined) {
          updates.addressEncrypted = encryptField(address);
        }

        const database = getDatabase();
        await database.collection("users").updateOne({ _id: new ObjectId(req.auth.sub) }, { $set: updates });

        return res.status(200).json({ status: "ok" });
      } catch (error) {
        return next(error);
      }
    },

    getProfileMe: async (req, res, next) => {
      try {
        const database = getDatabase();
        const user = await database.collection("users").findOne({ _id: new ObjectId(req.auth.sub) });
        if (!user) {
          return next(createError(404, "USER_NOT_FOUND", "User not found"));
        }

        const isPrivileged = hasRole(req, STAFF_ROLES) || hasRole(req, ["administrator", "moderator"]);
        const phone = decryptField(user.phoneEncrypted);
        const address = decryptField(user.addressEncrypted);

        return res.status(200).json({
          profile: {
            id: user._id.toString(),
            username: user.username,
            roles: user.roles,
            phone: isPrivileged ? phone : maskPhone(phone),
            address: isPrivileged ? address : maskAddress(address),
          },
        });
      } catch (error) {
        return next(error);
      }
    },

    addFavoriteByServiceId: async (req, res, next) => {
      try {
        const serviceId = parseObjectIdOrNull(req.params.serviceId);
        if (!serviceId) {
          return next(createError(400, "INVALID_SERVICE_ID", "Service id is invalid"));
        }

        const database = getDatabase();
        const service = await database.collection("services").findOne({ _id: serviceId, published: true });
        if (!service) {
          return next(createError(404, "SERVICE_NOT_FOUND", "Service not found"));
        }

        await database.collection("favorites").updateOne(
          { userId: new ObjectId(req.auth.sub), serviceId },
          {
            $set: { updatedAt: new Date() },
            $setOnInsert: { createdAt: new Date() },
          },
          { upsert: true },
        );

        return res.status(200).json({ status: "ok" });
      } catch (error) {
        return next(error);
      }
    },

    removeFavoriteByServiceId: async (req, res, next) => {
      try {
        const serviceId = parseObjectIdOrNull(req.params.serviceId);
        if (!serviceId) {
          return next(createError(400, "INVALID_SERVICE_ID", "Service id is invalid"));
        }

        const database = getDatabase();
        await database.collection("favorites").deleteOne({
          userId: new ObjectId(req.auth.sub),
          serviceId,
        });

        return res.status(200).json({ status: "ok" });
      } catch (error) {
        return next(error);
      }
    },

    listFavorites: async (req, res, next) => {
      try {
        const database = getDatabase();
        const favorites = await database
          .collection("favorites")
          .find({ userId: new ObjectId(req.auth.sub) })
          .sort({ createdAt: -1 })
          .toArray();

        const serviceIds = favorites.map((item) => item.serviceId);
        const services = await database
          .collection("services")
          .find({ _id: { $in: serviceIds }, published: true })
          .toArray();

        const servicesById = new Map(services.map((service) => [service._id.toString(), service]));

        return res.status(200).json({
          favorites: favorites
            .map((favorite) => servicesById.get(favorite.serviceId.toString()))
            .filter(Boolean)
            .map((service) => ({
              id: service._id.toString(),
              title: service.title,
              category: service.category,
              tags: service.tags,
            })),
        });
      } catch (error) {
        return next(error);
      }
    },

    setCompareList: async (req, res, next) => {
      try {
        const serviceIdsInput = req.body?.serviceIds;
        if (!Array.isArray(serviceIdsInput)) {
          return next(createError(400, "INVALID_COMPARE_LIST", "serviceIds must be an array"));
        }
        if (serviceIdsInput.length > 5) {
          return next(
            createError(400, "COMPARE_LIMIT_EXCEEDED", "Compare list can contain at most five services"),
          );
        }

        const parsedServiceIds = serviceIdsInput.map((id) => parseObjectIdOrNull(id));
        if (parsedServiceIds.some((id) => !id)) {
          return next(createError(400, "INVALID_SERVICE_ID", "One or more service ids are invalid"));
        }

        const dedupedIds = [...new Set(parsedServiceIds.map((id) => id.toString()))].map(
          (id) => new ObjectId(id),
        );

        const database = getDatabase();
        const servicesCount = await database
          .collection("services")
          .countDocuments({ _id: { $in: dedupedIds }, published: true });
        if (servicesCount !== dedupedIds.length) {
          return next(
            createError(400, "SERVICE_NOT_FOUND", "One or more services do not exist or are unpublished"),
          );
        }

        await database.collection("compare_lists").updateOne(
          { userId: new ObjectId(req.auth.sub) },
          {
            $set: {
              serviceIds: dedupedIds,
              updatedAt: new Date(),
            },
            $setOnInsert: { createdAt: new Date() },
          },
          { upsert: true },
        );

        return res.status(200).json({
          serviceIds: dedupedIds.map((id) => id.toString()),
        });
      } catch (error) {
        return next(error);
      }
    },

    getCompareList: async (req, res, next) => {
      try {
        const database = getDatabase();
        const compareList = await database
          .collection("compare_lists")
          .findOne({ userId: new ObjectId(req.auth.sub) });
        return res.status(200).json({
          serviceIds: (compareList?.serviceIds || []).map((id) => id.toString()),
        });
      } catch (error) {
        return next(error);
      }
    },

    createQuote: async (req, res, next) => {
      try {
        const {
          lineItems,
          slotStart,
          bookingRequestedAt,
          milesFromDepot,
          jurisdictionId,
          sameDayPriority,
          taxEnabled,
        } = req.body || {};

        const quote = await buildQuoteFromRequestPayload({
          lineItems,
          slotStart,
          bookingRequestedAt,
          milesFromDepot,
          jurisdictionId,
          sameDayPriority,
          taxEnabled,
        });

        return res.status(200).json({
          ...quote,
          quoteSignature: createQuoteSignature(quote),
        });
      } catch (error) {
        return next(error);
      }
    },

    listQuoteSlots: async (req, res, next) => {
      try {
        const serviceId = parseObjectIdOrNull(req.query?.serviceId);
        if (!serviceId) {
          return next(createError(400, "INVALID_SERVICE_ID", "serviceId is required and must be valid"));
        }

        const limitRaw = Number(req.query?.limit);
        const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 20) : 12;
        const startAfter = req.query?.startAfter ? new Date(String(req.query.startAfter)) : new Date();
        const startAt = Number.isNaN(startAfter.getTime()) ? new Date() : startAfter;

        const database = getDatabase();
        const slots = await database
          .collection("capacity_slots")
          .find({
            serviceId,
            remainingCapacity: { $gt: 0 },
            startTime: { $gte: startAt },
          })
          .sort({ startTime: 1 })
          .limit(limit)
          .toArray();

        return res.status(200).json({
          slots: slots.map((slot) => ({
            slotId: slot._id.toString(),
            startTime: slot.startTime,
            remainingCapacity: slot.remainingCapacity,
          })),
        });
      } catch (error) {
        return next(error);
      }
    },

    listQuoteJurisdictions: async (req, res, next) => {
      try {
        const database = getDatabase();
        const jurisdictions = await database
          .collection("jurisdictions")
          .find({})
          .sort({ _id: 1 })
          .toArray();

        return res.status(200).json({
          jurisdictions: jurisdictions.map((jurisdiction) => ({
            id: jurisdiction._id,
            name: jurisdiction.name || jurisdiction._id,
            taxRequired: Boolean(jurisdiction.taxRequired),
            taxRate: Number(jurisdiction.taxRate || 0),
          })),
        });
      } catch (error) {
        return next(error);
      }
    },
  };
}

module.exports = {
  createCustomerController,
};
