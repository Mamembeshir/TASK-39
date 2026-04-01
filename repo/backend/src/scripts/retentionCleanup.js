const fs = require("fs/promises");
const path = require("path");
const { MongoClient } = require("mongodb");

const uri = process.env.MONGO_URI || "mongodb://mongodb:27017/homecareops";
const MEDIA_UPLOAD_DIR = process.env.MEDIA_UPLOAD_DIR || "/data/uploads";
const RETENTION_DAYS = 365;

function parseDatabaseName(connectionUri) {
  try {
    const url = new URL(connectionUri);
    return url.pathname.replace(/^\//, "") || "homecareops";
  } catch (error) {
    return "homecareops";
  }
}

async function hasExternalMediaReferences(db, mediaId) {
  const [reviewRef, contentRef, ticketRef] = await Promise.all([
    db.collection("reviews").findOne({ mediaIds: mediaId }, { projection: { _id: 1 } }),
    db.collection("content_versions").findOne({ "versions.mediaIds": mediaId }, { projection: { _id: 1 } }),
    db.collection("tickets").findOne(
      {
        $or: [{ attachmentIds: mediaId }, { "immutableOutcome.attachmentIds": mediaId }],
      },
      { projection: { _id: 1 } },
    ),
  ]);

  return Boolean(reviewRef || contentRef || ticketRef);
}

async function decrementAndMaybeDeleteMedia(db, mediaId) {
  const media = await db.collection("media_metadata").findOne({ _id: mediaId });
  if (!media) {
    return { decremented: false, deletedBlob: false };
  }

  await db
    .collection("media_metadata")
    .updateOne({ _id: mediaId }, { $inc: { refCount: -1 }, $set: { updatedAt: new Date() } });

  const updated = await db.collection("media_metadata").findOne({ _id: mediaId });
  if (!updated) {
    return { decremented: true, deletedBlob: false };
  }

  if ((updated.refCount || 0) > 0) {
    return { decremented: true, deletedBlob: false };
  }

  const stillReferenced = await hasExternalMediaReferences(db, mediaId);
  if (stillReferenced) {
    await db
      .collection("media_metadata")
      .updateOne({ _id: mediaId }, { $set: { refCount: 1, updatedAt: new Date() } });
    return { decremented: true, deletedBlob: false };
  }

  await db.collection("media_metadata").deleteOne({ _id: mediaId });
  if (updated.storagePath) {
    await fs.rm(path.join(MEDIA_UPLOAD_DIR, updated.storagePath), { force: true });
  }
  return { decremented: true, deletedBlob: true };
}

async function main() {
  const client = new MongoClient(uri);
  await client.connect();

  try {
    const db = client.db(parseDatabaseName(uri));
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const candidates = await db
      .collection("tickets")
      .find({
        status: "resolved",
        legalHold: { $ne: true },
        cleanedAt: null,
        $or: [{ "immutableOutcome.resolvedAt": { $lte: cutoff } }, { updatedAt: { $lte: cutoff } }],
      })
      .toArray();

    let processedTickets = 0;
    let deletedBlobs = 0;

    for (const ticket of candidates) {
      const mediaIds = [
        ...(ticket.attachmentIds || []),
        ...((ticket.immutableOutcome && ticket.immutableOutcome.attachmentIds) || []),
      ];

      for (const mediaId of mediaIds) {
        const result = await decrementAndMaybeDeleteMedia(db, mediaId);
        if (result.deletedBlob) {
          deletedBlobs += 1;
        }
      }

      await db.collection("tickets").updateOne(
        { _id: ticket._id },
        {
          $set: {
            attachmentIds: [],
            cleanedAt: new Date(),
            updatedAt: new Date(),
            "immutableOutcome.attachmentIds": [],
          },
        },
      );
      processedTickets += 1;
    }

    console.log(
      `retention cleanup completed: processed ${processedTickets} tickets, deleted ${deletedBlobs} blobs`,
    );
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(`retention cleanup failed: ${error.message}`);
  process.exit(1);
});
