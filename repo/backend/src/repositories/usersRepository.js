const { ObjectId } = require("mongodb");
const { getDatabase } = require("../db");

async function insertUser(user) {
  const database = getDatabase();
  return database.collection("users").insertOne(user);
}

async function findUserByUsername(username) {
  const database = getDatabase();
  return database.collection("users").findOne({ username });
}

async function findUserById(userId) {
  const database = getDatabase();
  return database.collection("users").findOne({ _id: new ObjectId(userId) });
}

async function getLoginAttempt(username) {
  const database = getDatabase();
  return database.collection("login_attempts").findOne({ _id: username });
}

async function upsertLoginAttempt(username, payload) {
  const database = getDatabase();
  return database.collection("login_attempts").updateOne(
    { _id: username },
    {
      $set: {
        failedAt: payload.failedAt,
        lockedUntil: payload.lockedUntil,
        updatedAt: payload.updatedAt,
      },
      $setOnInsert: { createdAt: payload.createdAt },
    },
    { upsert: true },
  );
}

async function clearLoginAttempt(username) {
  const database = getDatabase();
  return database.collection("login_attempts").deleteOne({ _id: username });
}

async function insertRefreshToken(tokenDoc) {
  const database = getDatabase();
  return database.collection("refresh_tokens").insertOne(tokenDoc);
}

async function findRefreshTokenByHash(tokenHash) {
  const database = getDatabase();
  return database.collection("refresh_tokens").findOne({ tokenHash, revokedAt: null });
}

async function revokeRefreshTokenByHash(tokenHash) {
  const database = getDatabase();
  return database
    .collection("refresh_tokens")
    .updateOne({ tokenHash }, { $set: { revokedAt: new Date(), updatedAt: new Date() } });
}

module.exports = {
  insertUser,
  findUserByUsername,
  findUserById,
  getLoginAttempt,
  upsertLoginAttempt,
  clearLoginAttempt,
  insertRefreshToken,
  findRefreshTokenByHash,
  revokeRefreshTokenByHash,
};
