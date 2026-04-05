const { logger } = require("../../utils/logger");

function createSlotService({ getDatabase }) {
  function normalizeSlotAllocations(slotAllocations = []) {
    if (!Array.isArray(slotAllocations)) {
      return [];
    }

    return slotAllocations
      .map((entry) => {
        if (entry && typeof entry === "object" && entry.slotId) {
          const units = Number(entry.units || 1);
          return {
            slotId: entry.slotId,
            units: Number.isInteger(units) && units > 0 ? units : 1,
          };
        }
        return {
          slotId: entry,
          units: 1,
        };
      })
      .filter((entry) => Boolean(entry.slotId));
  }

  async function releaseSlotCapacity(slotAllocations) {
    const normalized = normalizeSlotAllocations(slotAllocations);
    if (normalized.length === 0) {
      return;
    }

    const database = getDatabase();
    await Promise.all(
      normalized.map(({ slotId, units }) =>
        database
          .collection("capacity_slots")
          .updateOne({ _id: slotId }, { $inc: { remainingCapacity: units }, $set: { updatedAt: new Date() } }),
      ),
    );
  }

  async function findAlternativeSlots(slot, limit = 5, requiredCapacityUnits = 1) {
    const minimumCapacity = Number.isInteger(requiredCapacityUnits) && requiredCapacityUnits > 0 ? requiredCapacityUnits : 1;
    const database = getDatabase();
    const alternatives = await database
      .collection("capacity_slots")
      .find({
        serviceId: slot.serviceId,
        startTime: { $gte: slot.startTime },
        remainingCapacity: { $gte: minimumCapacity },
        _id: { $ne: slot._id },
      })
      .sort({ startTime: 1 })
      .limit(limit)
      .toArray();

    return alternatives.map((item) => ({
      slotId: item._id.toString(),
      startTime: item.startTime,
      remainingCapacity: item.remainingCapacity,
    }));
  }

  async function releaseExpiredPendingOrders() {
    const database = getDatabase();
    const now = new Date();

    let hasMore = true;
    while (hasMore) {
      const order = await database.collection("orders").findOne(
        {
          state: "pending_confirmation",
          expiresAt: { $lte: now },
          capacityReleasedAt: null,
        },
        { sort: { expiresAt: 1 } },
      );

      if (!order) {
        hasMore = false;
        continue;
      }

      const claimed = await database.collection("orders").updateOne(
        {
          _id: order._id,
          state: "pending_confirmation",
          capacityReleasedAt: null,
        },
        {
          $set: {
            state: "cancelled",
            cancelledReason: "pending_timeout",
            capacityReleasedAt: now,
            updatedAt: now,
          },
        },
      );

      if (claimed.modifiedCount === 0) {
        continue;
      }

      await releaseSlotCapacity(order.slotAllocations || order.slotIds || []);
    }
  }

  function startPendingOrderReleaseWorker() {
    const intervalMs = 60 * 1000;
    setInterval(() => {
      releaseExpiredPendingOrders().catch((error) => {
        logger.error({ err: error }, "Pending order release worker failed");
      });
    }, intervalMs);
  }

  return {
    findAlternativeSlots,
    releaseSlotCapacity,
    startPendingOrderReleaseWorker,
  };
}

module.exports = {
  createSlotService,
};
