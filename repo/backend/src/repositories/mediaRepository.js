const { getDatabase } = require("../db");

async function findMediaBySha256(sha256) {
  const database = getDatabase();
  return database.collection("media_metadata").findOne({ sha256 });
}

async function incrementMediaRefCount(mediaId) {
  const database = getDatabase();
  return database
    .collection("media_metadata")
    .updateOne({ _id: mediaId }, { $inc: { refCount: 1 }, $set: { updatedAt: new Date() } });
}

async function insertMedia(doc) {
  const database = getDatabase();
  return database.collection("media_metadata").insertOne(doc);
}

async function findAndIncrementBySha256(sha256) {
  const database = getDatabase();
  return database
    .collection("media_metadata")
    .findOneAndUpdate(
      { sha256 },
      { $inc: { refCount: 1 }, $set: { updatedAt: new Date() } },
      { returnDocument: "after" },
    );
}

async function findMediaById(mediaId) {
  const database = getDatabase();
  return database.collection("media_metadata").findOne({ _id: mediaId });
}

async function findMediaByIds(mediaIds) {
  if (!mediaIds.length) {
    return [];
  }
  const database = getDatabase();
  return database.collection("media_metadata").find({ _id: { $in: mediaIds } }).toArray();
}

async function findMediaReferences(mediaId) {
  const database = getDatabase();
  const [reviewRef, ticketRef, contentRef] = await Promise.all([
    database.collection("reviews").findOne({ mediaIds: mediaId }, { projection: { _id: 1 } }),
    database
      .collection("tickets")
      .findOne(
        { $or: [{ attachmentIds: mediaId }, { "immutableOutcome.attachmentIds": mediaId }] },
        { projection: { _id: 1 } },
      ),
    database.collection("content_versions").findOne(
      {
        $or: [{ mediaRefs: mediaId }, { "versions.mediaRefs": mediaId }, { "versions.mediaIds": mediaId }],
      },
      { projection: { _id: 1 } },
    ),
  ]);

  return { contentRef, reviewRef, ticketRef };
}

async function deleteMediaById(mediaId) {
  const database = getDatabase();
  return database.collection("media_metadata").deleteOne({ _id: mediaId });
}

module.exports = {
  deleteMediaById,
  findAndIncrementBySha256,
  findMediaById,
  findMediaByIds,
  findMediaBySha256,
  findMediaReferences,
  incrementMediaRefCount,
  insertMedia,
};
