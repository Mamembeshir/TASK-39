const { getDatabase } = require("../db");

async function findSettings() {
  const database = getDatabase();
  return database.collection("settings").findOne({});
}

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

async function findBundlesByIds(bundleIds) {
  if (!bundleIds.length) {
    return [];
  }
  const database = getDatabase();
  return database
    .collection("bundles")
    .find({ _id: { $in: bundleIds } })
    .toArray();
}

async function insertReview(doc) {
  const database = getDatabase();
  return database.collection("reviews").insertOne(doc);
}

async function moderateReview(reviewId, setDoc) {
  const database = getDatabase();
  return database.collection("reviews").updateOne({ _id: reviewId }, { $set: setDoc });
}

async function findReviewsByStatus(status) {
  const database = getDatabase();
  return database
    .collection("reviews")
    .find(
      { status },
      {
        projection: {
          _id: 1,
          orderId: 1,
          status: 1,
          text: 1,
          rating: 1,
          createdAt: 1,
          moderation: 1,
        },
      },
    )
    .sort({ createdAt: -1 })
    .toArray();
}

module.exports = {
  findBundlesByIds,
  findMediaByIds,
  findOrderById,
  findSettings,
  findReviewsByStatus,
  insertReview,
  moderateReview,
};
