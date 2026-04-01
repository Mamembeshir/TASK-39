const { getDatabase } = require("../db");

async function insertMessage(messageDoc) {
  const database = getDatabase();
  return database.collection("messages").insertOne(messageDoc);
}

async function listMessages(visibilityFilter) {
  const database = getDatabase();
  return database
    .collection("messages")
    .find(visibilityFilter)
    .sort({ publishAt: -1, createdAt: -1 })
    .toArray();
}

async function markMessageRead(messageId, visibilityFilter, userId) {
  const database = getDatabase();
  return database.collection("messages").findOneAndUpdate(
    { _id: messageId, ...visibilityFilter },
    {
      $addToSet: { readByUserIds: userId },
      $set: { updatedAt: new Date() },
    },
    { returnDocument: "after" },
  );
}

module.exports = {
  insertMessage,
  listMessages,
  markMessageRead,
};
