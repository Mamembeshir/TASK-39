const { getDatabase } = require("../db");

async function insertContent(doc) {
  const database = getDatabase();
  return database.collection("content_versions").insertOne(doc);
}

async function findContentById(contentId) {
  const database = getDatabase();
  return database.collection("content_versions").findOne({ _id: contentId });
}

async function findPublishedContentSummaries() {
  const database = getDatabase();
  return database
    .collection("content_versions")
    .find(
      { status: "published", publishedVersionId: { $ne: null } },
      {
        projection: {
          _id: 1,
          slug: 1,
          publishedAt: 1,
          versions: 1,
          publishedVersionId: 1,
        },
      },
    )
    .sort({ publishedAt: -1, createdAt: -1 })
    .toArray();
}

async function findAllContentSummaries() {
  const database = getDatabase();
  return database
    .collection("content_versions")
    .find(
      {},
      {
        projection: {
          _id: 1,
          slug: 1,
          status: 1,
          publishedAt: 1,
          scheduledPublishAt: 1,
          versions: 1,
          publishedVersionId: 1,
          currentVersionId: 1,
        },
      },
    )
    .sort({ updatedAt: -1, createdAt: -1 })
    .toArray();
}

async function findPublishedContentById(contentId) {
  const database = getDatabase();
  return database.collection("content_versions").findOne({ _id: contentId, status: "published", publishedVersionId: { $ne: null } });
}

async function pushDraftVersion(contentId, version) {
  const database = getDatabase();
  return database.collection("content_versions").findOneAndUpdate(
    { _id: contentId },
    {
      $push: { versions: version },
      $set: {
        currentVersionId: version.id,
        mediaRefs: version.mediaRefs || [],
        status: "draft",
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" },
  );
}

async function updateSchedule(contentId, scheduledPublishAt, scheduledVersionId) {
  const database = getDatabase();
  return database.collection("content_versions").updateOne(
    { _id: contentId },
    {
      $set: {
        scheduledPublishAt,
        scheduledVersionId,
        status: "scheduled",
        updatedAt: new Date(),
      },
    },
  );
}

async function publishVersion(contentId, versionId, mediaRefs = []) {
  const database = getDatabase();
  return database.collection("content_versions").updateOne(
    { _id: contentId },
    {
      $set: {
        publishedVersionId: versionId,
        mediaRefs,
        status: "published",
        scheduledPublishAt: null,
        scheduledVersionId: null,
        publishedAt: new Date(),
        updatedAt: new Date(),
      },
    },
  );
}

async function rollbackVersion(contentId, versionId, mediaRefs = []) {
  const database = getDatabase();
  return database.collection("content_versions").updateOne(
    { _id: contentId },
    {
      $set: {
        publishedVersionId: versionId,
        mediaRefs,
        status: "published",
        updatedAt: new Date(),
      },
    },
  );
}

async function publishNextDueScheduledContent(now = new Date()) {
  const database = getDatabase();
  const dueContent = await database.collection("content_versions").findOne(
    {
      status: "scheduled",
      scheduledPublishAt: { $lte: now },
      scheduledVersionId: { $ne: null },
    },
    { sort: { scheduledPublishAt: 1, updatedAt: 1 } },
  );

  if (!dueContent || !dueContent.scheduledVersionId) {
    return null;
  }

  const publishResult = await database.collection("content_versions").updateOne(
    {
      _id: dueContent._id,
      status: "scheduled",
      scheduledVersionId: dueContent.scheduledVersionId,
      scheduledPublishAt: dueContent.scheduledPublishAt,
    },
    {
      $set: {
        publishedVersionId: dueContent.scheduledVersionId,
        status: "published",
        scheduledPublishAt: null,
        scheduledVersionId: null,
        publishedAt: now,
        updatedAt: now,
      },
    },
  );

  if (publishResult.modifiedCount === 0) {
    return null;
  }

  return {
    id: dueContent._id,
    publishedVersionId: dueContent.scheduledVersionId,
  };
}

module.exports = {
  findContentById,
  findAllContentSummaries,
  findPublishedContentById,
  findPublishedContentSummaries,
  insertContent,
  publishVersion,
  publishNextDueScheduledContent,
  pushDraftVersion,
  rollbackVersion,
  updateSchedule,
};
