const { getDatabase } = require("../db");

async function findCapacitySlotById(slotId) {
  const database = getDatabase();
  return database.collection("capacity_slots").findOne({ _id: slotId });
}

async function listCapacitySlots() {
  const database = getDatabase();
  return database
    .collection("capacity_slots")
    .find({}, { projection: { _id: 1, serviceId: 1, startTime: 1, remainingCapacity: 1, createdAt: 1, updatedAt: 1 } })
    .sort({ startTime: 1 })
    .limit(100)
    .toArray();
}

async function insertCapacitySlot(slotDoc) {
  const database = getDatabase();
  return database.collection("capacity_slots").insertOne(slotDoc);
}

async function updateCapacitySlot(slotId, updates) {
  const database = getDatabase();
  return database.collection("capacity_slots").updateOne({ _id: slotId }, { $set: updates });
}

async function deleteCapacitySlot(slotId) {
  const database = getDatabase();
  return database.collection("capacity_slots").deleteOne({ _id: slotId });
}

async function decrementCapacitySlot(slotId, requiredCapacityUnits = 1) {
  const database = getDatabase();
  const units = Number.isInteger(requiredCapacityUnits) && requiredCapacityUnits > 0 ? requiredCapacityUnits : 1;
  return database
    .collection("capacity_slots")
    .findOneAndUpdate(
      { _id: slotId, remainingCapacity: { $gte: units } },
      { $inc: { remainingCapacity: -units }, $set: { updatedAt: new Date() } },
      { returnDocument: "after" },
    );
}

async function incrementCapacitySlot(slotId, requiredCapacityUnits = 1) {
  const database = getDatabase();
  const units = Number.isInteger(requiredCapacityUnits) && requiredCapacityUnits > 0 ? requiredCapacityUnits : 1;
  return database
    .collection("capacity_slots")
    .updateOne({ _id: slotId }, { $inc: { remainingCapacity: units }, $set: { updatedAt: new Date() } });
}

async function findSettings() {
  const database = getDatabase();
  return database.collection("settings").findOne({});
}

async function insertOrder(orderDoc) {
  const database = getDatabase();
  return database.collection("orders").insertOne(orderDoc);
}

async function findOrderById(orderId) {
  const database = getDatabase();
  return database.collection("orders").findOne({ _id: orderId });
}

async function findOrdersByCustomerId(customerId) {
  const database = getDatabase();
  return database
    .collection("orders")
    .find(
      { customerId },
      {
        projection: {
          _id: 1,
          state: 1,
          pricingSnapshot: 1,
          createdAt: 1,
          updatedAt: 1,
          slotStart: 1,
          expiresAt: 1,
        },
      },
    )
    .sort({ createdAt: -1 })
    .toArray();
}

async function findUserById(userId) {
  const database = getDatabase();
  return database.collection("users").findOne({ _id: userId });
}

async function cancelOrder(orderId, now) {
  const database = getDatabase();
  return database.collection("orders").updateOne(
    { _id: orderId, state: { $in: ["pending_confirmation", "confirmed"] } },
    {
      $set: {
        state: "cancelled",
        cancelledReason: "customer_cancelled",
        capacityReleasedAt: now,
        updatedAt: now,
      },
    },
  );
}

async function completeOrder(orderId) {
  const database = getDatabase();
  return database.collection("orders").updateOne(
    { _id: orderId, state: { $in: ["confirmed", "in_progress"] } },
    {
      $set: {
        state: "completed",
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    },
  );
}

module.exports = {
  cancelOrder,
  completeOrder,
  decrementCapacitySlot,
  findCapacitySlotById,
  findOrderById,
  findOrdersByCustomerId,
  findSettings,
  findUserById,
  incrementCapacitySlot,
  insertCapacitySlot,
  insertOrder,
  listCapacitySlots,
  updateCapacitySlot,
  deleteCapacitySlot,
};
