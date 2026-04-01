const { getDatabase } = require("../db");

async function findServices(filter) {
  const database = getDatabase();
  return database.collection("services").find(filter).sort({ createdAt: -1 }).toArray();
}

async function searchDocuments(query, now) {
  const database = getDatabase();
  return database
    .collection("search_documents")
    .find(
      {
        publishAt: { $lte: now },
        $text: { $search: query },
      },
      {
        projection: {
          score: { $meta: "textScore" },
          type: 1,
          sourceId: 1,
          title: 1,
          body: 1,
          tags: 1,
        },
      },
    )
    .sort({ score: { $meta: "textScore" } })
    .limit(25)
    .toArray();
}

async function findServiceById(serviceId) {
  const database = getDatabase();
  return database.collection("services").findOne({ _id: serviceId });
}

async function findPublishedServiceById(serviceId) {
  const database = getDatabase();
  return database.collection("services").findOne({ _id: serviceId, published: true });
}

async function findBundlesByIds(bundleIds) {
  const database = getDatabase();
  return database
    .collection("bundles")
    .find({ _id: { $in: bundleIds } })
    .toArray();
}

async function findServiceQuestions(serviceId) {
  const database = getDatabase();
  return database
    .collection("service_questions")
    .find({ serviceId, status: "published" })
    .sort({ createdAt: -1 })
    .toArray();
}

async function findPendingServiceQuestions() {
  const database = getDatabase();
  return database
    .collection("service_questions")
    .find({ status: "pending_moderation" })
    .sort({ createdAt: 1 })
    .toArray();
}

async function insertServiceQuestion(doc) {
  const database = getDatabase();
  return database.collection("service_questions").insertOne(doc);
}

async function findServiceQuestionById(questionId) {
  const database = getDatabase();
  return database.collection("service_questions").findOne({ _id: questionId });
}

async function updateServiceQuestionById(questionId, setDoc) {
  const database = getDatabase();
  return database.collection("service_questions").updateOne({ _id: questionId }, { $set: setDoc });
}

async function findServiceReviews(serviceId) {
  const database = getDatabase();
  return database
    .collection("reviews")
    .find({
      serviceIds: serviceId,
      status: { $in: ["approved", "published"] },
      verified: true,
    })
    .sort({ createdAt: -1 })
    .toArray();
}

async function insertService(doc) {
  const database = getDatabase();
  return database.collection("services").insertOne(doc);
}

async function updateServiceById(serviceId, setDoc) {
  const database = getDatabase();
  return database.collection("services").updateOne({ _id: serviceId }, { $set: setDoc });
}

async function insertBundle(doc) {
  const database = getDatabase();
  return database.collection("bundles").insertOne(doc);
}

async function updateBundleById(bundleId, setDoc) {
  const database = getDatabase();
  return database.collection("bundles").updateOne({ _id: bundleId }, { $set: setDoc });
}

module.exports = {
  findBundlesByIds,
  findPendingServiceQuestions,
  findServiceQuestionById,
  findPublishedServiceById,
  findServiceById,
  findServiceQuestions,
  findServiceReviews,
  findServices,
  insertServiceQuestion,
  insertBundle,
  insertService,
  searchDocuments,
  updateServiceQuestionById,
  updateBundleById,
  updateServiceById,
};
