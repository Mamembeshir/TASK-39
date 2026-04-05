function createInternalController(deps) {
  const { createError, getDatabase, ObjectId, writeAuditLog } = deps;

  async function logInternalAction(req, action, details = null) {
    await writeAuditLog({
      username: req.auth?.username,
      userId: req.auth?.sub ? new ObjectId(req.auth.sub) : null,
      action,
      outcome: "success",
      req,
      details,
    });
  }

  return {
    seedCheck: async (req, res, next) => {
      try {
        const database = getDatabase();
        const [
          userCount,
          serviceCount,
          bundleCount,
          travelZoneCount,
          jurisdictionCount,
          capacitySlotCount,
          orderCount,
          reviewCount,
          ticketCount,
          messageCount,
          contentCount,
          mediaCount,
          auditCount,
          settingsCount,
        ] = await Promise.all([
          database.collection("users").countDocuments(),
          database.collection("services").countDocuments(),
          database.collection("bundles").countDocuments(),
          database.collection("travel_zones").countDocuments(),
          database.collection("jurisdictions").countDocuments(),
          database.collection("capacity_slots").countDocuments(),
          database.collection("orders").countDocuments(),
          database.collection("reviews").countDocuments(),
          database.collection("tickets").countDocuments(),
          database.collection("messages").countDocuments(),
          database.collection("content_versions").countDocuments(),
          database.collection("media_metadata").countDocuments(),
          database.collection("audit_logs").countDocuments(),
          database.collection("settings").countDocuments(),
        ]);

        const customerUser = await database
          .collection("users")
          .findOne({ username: "customer_demo" }, { projection: { _id: 0, username: 1, roles: 1 } });

        await logInternalAction(req, "internal.seed_check", {
          users: userCount,
          orders: orderCount,
          tickets: ticketCount,
        });

        return res.status(200).json({
          customerUser,
          counts: {
            users: userCount,
            services: serviceCount,
            bundles: bundleCount,
            travel_zones: travelZoneCount,
            jurisdictions: jurisdictionCount,
            capacity_slots: capacitySlotCount,
            orders: orderCount,
            reviews: reviewCount,
            tickets: ticketCount,
            messages: messageCount,
            content_versions: contentCount,
            media_metadata: mediaCount,
            audit_logs: auditCount,
            settings: settingsCount,
          },
        });
      } catch (error) {
        return next(error);
      }
    },

    createBookingSlotFixture: async (req, res, next) => {
      try {
        const database = getDatabase();
        const now = new Date();
        const targetStart = new Date(now.getTime() + 2 * 60 * 60 * 1000);
        const alt1Start = new Date(now.getTime() + 3 * 60 * 60 * 1000);
        const alt2Start = new Date(now.getTime() + 4 * 60 * 60 * 1000);

        const targetSlotId = new ObjectId();
        const altSlotId1 = new ObjectId();
        const altSlotId2 = new ObjectId();

        await database.collection("capacity_slots").insertMany([
          {
            _id: targetSlotId,
            serviceId: new ObjectId("65f000000000000000000101"),
            startTime: targetStart,
            remainingCapacity: 1,
            createdAt: now,
            updatedAt: now,
          },
          {
            _id: altSlotId1,
            serviceId: new ObjectId("65f000000000000000000101"),
            startTime: alt1Start,
            remainingCapacity: 2,
            createdAt: now,
            updatedAt: now,
          },
          {
            _id: altSlotId2,
            serviceId: new ObjectId("65f000000000000000000101"),
            startTime: alt2Start,
            remainingCapacity: 1,
            createdAt: now,
            updatedAt: now,
          },
        ]);

        await logInternalAction(req, "internal.fixture.booking_slot", {
          targetSlotId: targetSlotId.toString(),
        });

        return res.status(201).json({
          targetSlotId: targetSlotId.toString(),
          targetStart,
          alternativeSlotIds: [altSlotId1.toString(), altSlotId2.toString()],
        });
      } catch (error) {
        return next(error);
      }
    },

    createCompletedOrderFixture: async (req, res, next) => {
      try {
        const database = getDatabase();
        const now = new Date();
        const completedAt = new Date(now.getTime() - 60 * 60 * 1000);

        const result = await database.collection("orders").insertOne({
          customerId: new ObjectId("65f000000000000000000001"),
          state: "completed",
          lineItems: [
            {
              type: "service",
              serviceId: new ObjectId("65f000000000000000000101"),
              durationMinutes: 60,
              quantity: 1,
            },
          ],
          slotIds: [],
          pricingSnapshot: { subtotalBeforeTax: 100, tax: 0, total: 100 },
          completedAt,
          createdAt: now,
          updatedAt: now,
        });

        await logInternalAction(req, "internal.fixture.completed_order", {
          orderId: result.insertedId.toString(),
        });

        return res.status(201).json({ orderId: result.insertedId.toString(), completedAt });
      } catch (error) {
        return next(error);
      }
    },

    blacklistIpFixture: async (req, res, next) => {
      try {
        const ip = typeof req.body?.ip === "string" ? req.body.ip.trim() : "";
        if (!ip) {
          return next(createError(400, "INVALID_IP", "ip is required"));
        }

        const database = getDatabase();
        await database.collection("blacklists").updateOne(
          { type: "ip", value: ip },
          {
            $set: { active: true, updatedAt: new Date() },
            $setOnInsert: { createdAt: new Date() },
          },
          { upsert: true },
        );

        await logInternalAction(req, "internal.fixture.blacklist_ip", { ip });

        return res.status(200).json({ status: "ok" });
      } catch (error) {
        return next(error);
      }
    },

    checkUsersUsernameConstraint: async (req, res, next) => {
      try {
        const database = getDatabase();
        const users = database.collection("users");
        const probeId = `duplicate-probe-${Date.now()}`;

        try {
          await users.insertOne({
            _id: probeId,
            username: "customer_demo",
            passwordHash: "noop",
            roles: ["customer"],
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          await users.deleteOne({ _id: probeId });
          await logInternalAction(req, "internal.constraint.users_username", { enforced: false });
          return res.status(200).json({ enforced: false });
        } catch (error) {
          if (error && error.code === 11000) {
            await logInternalAction(req, "internal.constraint.users_username", { enforced: true });
            return res.status(200).json({ enforced: true });
          }
          throw error;
        }
      } catch (error) {
        return next(error);
      }
    },
  };
}

module.exports = {
  createInternalController,
};
