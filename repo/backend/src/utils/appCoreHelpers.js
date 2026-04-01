function toOrgTimezoneDate(date, timeZone) {
  return new Date(date.toLocaleString("en-US", { timeZone }));
}

function parseObjectIdOrNull(ObjectId, value) {
  if (!value || !ObjectId.isValid(value)) {
    return null;
  }
  return new ObjectId(value);
}

function parseObjectIdArray(values, parseObjectId) {
  if (!Array.isArray(values)) {
    return { ok: false, parsed: [] };
  }
  const parsed = values.map((value) => parseObjectId(value));
  if (parsed.some((value) => !value)) {
    return { ok: false, parsed: [] };
  }
  return { ok: true, parsed };
}

function parseTagsQuery(queryValue) {
  if (!queryValue) {
    return [];
  }
  if (Array.isArray(queryValue)) {
    return queryValue
      .flatMap((item) => String(item).split(","))
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return String(queryValue)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildContentVersion(ObjectId, { title, body, mediaIds, mediaRefs }) {
  const normalizedBody = typeof body === "string" ? body.trim() : body == null ? "" : JSON.stringify(body);
  return {
    id: new ObjectId(),
    title: String(title || "").trim(),
    body: normalizedBody,
    mediaIds: mediaIds || [],
    mediaRefs: mediaRefs || mediaIds || [],
    createdAt: new Date(),
  };
}

module.exports = {
  buildContentVersion,
  parseObjectIdArray,
  parseObjectIdOrNull,
  parseTagsQuery,
  toOrgTimezoneDate,
};
