const { getDatabase } = require("../db");

async function findOrderById(orderId) {
  const database = getDatabase();
  return database.collection("orders").findOne({ _id: orderId });
}

async function findMediaByIds(mediaIds) {
  if (!mediaIds.length) {
    return [];
  }
  const database = getDatabase();
  return database
    .collection("media_metadata")
    .find({ _id: { $in: mediaIds } })
    .toArray();
}

async function findSettings() {
  const database = getDatabase();
  return database.collection("settings").findOne({});
}

async function insertTicket(ticketDoc) {
  const database = getDatabase();
  return database.collection("tickets").insertOne(ticketDoc);
}

async function findTicketById(ticketId) {
  const database = getDatabase();
  return database.collection("tickets").findOne({ _id: ticketId });
}

async function findTicketsByCustomerId(customerId) {
  const database = getDatabase();
  return database
    .collection("tickets")
    .find(
      { customerId },
      {
        projection: {
          _id: 1,
          orderId: 1,
          category: 1,
          routing: 1,
          status: 1,
          legalHold: 1,
          createdAt: 1,
          updatedAt: 1,
          sla: 1,
          immutableOutcome: 1,
        },
      },
    )
    .sort({ createdAt: -1 })
    .toArray();
}

async function findAllTickets() {
  const database = getDatabase();
  return database
    .collection("tickets")
    .find(
      {},
      {
        projection: {
          _id: 1,
          orderId: 1,
          customerId: 1,
          category: 1,
          routing: 1,
          status: 1,
          legalHold: 1,
          createdAt: 1,
          updatedAt: 1,
          sla: 1,
          immutableOutcome: 1,
        },
      },
    )
    .sort({ createdAt: -1 })
    .toArray();
}

async function updateTicketById(ticketId, updates) {
  const database = getDatabase();
  return database.collection("tickets").updateOne({ _id: ticketId }, { $set: updates });
}

async function updateTicketLegalHold(ticketId, legalHold) {
  const database = getDatabase();
  return database
    .collection("tickets")
    .updateOne({ _id: ticketId }, { $set: { legalHold, updatedAt: new Date() } });
}

async function resolveTicket(ticketId, outcome) {
  const database = getDatabase();
  return database.collection("tickets").updateOne(
    { _id: ticketId, immutableOutcome: null },
    {
      $set: {
        status: "resolved",
        immutableOutcome: outcome,
        updatedAt: new Date(),
      },
    },
  );
}

module.exports = {
  findMediaByIds,
  findAllTickets,
  findOrderById,
  findSettings,
  findTicketById,
  findTicketsByCustomerId,
  insertTicket,
  resolveTicket,
  updateTicketById,
  updateTicketLegalHold,
};
