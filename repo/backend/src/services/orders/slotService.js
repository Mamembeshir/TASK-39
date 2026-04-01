function createSlotService({ getDatabase }) {
  async function releaseSlotCapacity(slotIds) {
    if (!Array.isArray(slotIds) || slotIds.length === 0) {
      return;
    }

    const database = getDatabase();
    await Promise.all(
      slotIds.map((slotId) =>
        database
          .collection("capacity_slots")
          .updateOne({ _id: slotId }, { $inc: { remainingCapacity: 1 }, $set: { updatedAt: new Date() } }),
      ),
    );
  }

  async function findAlternativeSlots(slot, limit = 5) {
    const database = getDatabase();
    const alternatives = await database
      .collection("capacity_slots")
      .find({
        serviceId: slot.serviceId,
        startTime: { $gte: slot.startTime },
        remainingCapacity: { $gt: 0 },
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

      await releaseSlotCapacity(order.slotIds || []);
    }
  }

  function startPendingOrderReleaseWorker() {
    const intervalMs = 60 * 1000;
    setInterval(() => {
      releaseExpiredPendingOrders().catch((error) => {
        console.error(`Pending order release worker failed: ${error.message}`);
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
