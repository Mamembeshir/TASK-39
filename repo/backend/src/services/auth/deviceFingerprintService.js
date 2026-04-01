const crypto = require("crypto");

function parseCookieValue(cookieHeader, key) {
  if (!cookieHeader || typeof cookieHeader !== "string") {
    return "";
  }
  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const trimmed = pair.trim();
    if (trimmed.startsWith(`${key}=`)) {
      return trimmed.slice(key.length + 1);
    }
  }
  return "";
}

function getDeviceFingerprint(req) {
  const userAgent = req.headers["user-agent"] || "unknown-agent";
  const deviceId =
    req.headers["x-device-id"] || parseCookieValue(req.headers.cookie, "device_id") || "unknown-device";
  return crypto.createHash("sha256").update(`${userAgent}|${deviceId}`).digest("hex");
}

module.exports = {
  getDeviceFingerprint,
};
