const { getDatabase } = require("../db");

async function findMediaBySha256(sha256, dedupNamespace = null, purpose = null) {
  const database = getDatabase();
  const filter = { sha256 };
  if (dedupNamespace) {
    filter.$or = [
      { dedupNamespace },
      { dedupNamespace: { $exists: false }, purpose: dedupNamespaceFallbackPurposes(dedupNamespace, purpose) },
    ];
  }
  return database.collection("media_metadata").findOne(filter);
}

async function incrementMediaRefCount(mediaId, ownerId = null) {
  const database = getDatabase();
  const update = { $inc: { refCount: 1 }, $set: { updatedAt: new Date() } };
  if (ownerId) {
    const ownerKey = ownerId.toString();
    update.$inc[`ownerRefs.${ownerKey}`] = 1;
    update.$addToSet = { ownerIds: ownerId };
  }
  return database.collection("media_metadata").updateOne({ _id: mediaId }, update);
}

async function decrementMediaRefCount(mediaId, ownerId = null) {
  const database = getDatabase();
  const filter = { _id: mediaId, refCount: { $gt: 0 } };
  const update = { $inc: { refCount: -1 }, $set: { updatedAt: new Date() } };

  if (ownerId) {
    const ownerKey = ownerId.toString();
    update.$inc[`ownerRefs.${ownerKey}`] = -1;
    filter.$or = [
      { [`ownerRefs.${ownerKey}`]: { $gt: 0 } },
      { ownerIds: ownerId },
      { createdBy: ownerId },
    ];
  }

  const result = await database.collection("media_metadata").findOneAndUpdate(filter, update, { returnDocument: "after" });
  return result?.value ?? null;
}

async function cleanupMediaOwnerRef(mediaId, ownerId) {
  const database = getDatabase();
  const ownerKey = ownerId.toString();
  return database.collection("media_metadata").updateOne(
    { _id: mediaId },
    {
      $unset: { [`ownerRefs.${ownerKey}`]: "" },
      $pull: { ownerIds: ownerId },
      $set: { updatedAt: new Date() },
    },
  );
}

async function insertMedia(doc) {
  const database = getDatabase();
  return database.collection("media_metadata").insertOne(doc);
}

async function findAndIncrementBySha256(sha256, dedupNamespace = null, ownerId = null, purpose = null) {
  const database = getDatabase();
  const update = { $inc: { refCount: 1 }, $set: { updatedAt: new Date() } };
  if (ownerId) {
    const ownerKey = ownerId.toString();
    update.$inc[`ownerRefs.${ownerKey}`] = 1;
    update.$addToSet = { ownerIds: ownerId };
  }
  const filter = { sha256 };
  if (dedupNamespace) {
    filter.$or = [
      { dedupNamespace },
      { dedupNamespace: { $exists: false }, purpose: dedupNamespaceFallbackPurposes(dedupNamespace, purpose) },
    ];
  }
  const result = await database
    .collection("media_metadata")
    .findOneAndUpdate(
      filter,
      update,
      { returnDocument: "after" },
    );
  return result?.value ?? null;
}

function dedupNamespaceFallbackPurposes(dedupNamespace, purpose) {
  if (dedupNamespace === "public_asset" || dedupNamespace === "content") {
    return ["content", "public_asset"];
  }
  if (dedupNamespace === "review" || dedupNamespace === "ticket") {
    return [dedupNamespace];
  }
  return purpose ? [purpose] : [];
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
  cleanupMediaOwnerRef,
  deleteMediaById,
  decrementMediaRefCount,
  findAndIncrementBySha256,
  findMediaById,
  findMediaByIds,
  findMediaBySha256,
  findMediaReferences,
  incrementMediaRefCount,
  insertMedia,
};
