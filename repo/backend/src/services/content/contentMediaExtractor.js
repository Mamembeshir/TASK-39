function toReferenceString(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "object" && typeof value.toString === "function") {
    const stringValue = value.toString();
    if (stringValue && stringValue !== "[object Object]") {
      return stringValue;
    }
  }

  return null;
}

function addCandidateReference(refs, value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      addCandidateReference(refs, item);
    }
    return;
  }

  const ref = toReferenceString(value);
  if (ref) {
    refs.add(ref);
  }
}

function parseStructuredBody(body) {
  if (Array.isArray(body) || (body && typeof body === "object")) {
    return body;
  }

  if (typeof body !== "string") {
    return null;
  }

  const trimmed = body.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function collectMediaRefs(node, refs) {
  if (Array.isArray(node)) {
    for (const item of node) {
      collectMediaRefs(item, refs);
    }
    return;
  }

  if (!node || typeof node !== "object") {
    return;
  }

  for (const [key, value] of Object.entries(node)) {
    if (["mediaId", "mediaIds", "mediaRef", "mediaRefId", "assetId", "assetIds", "imageId", "imageIds"].includes(key)) {
      addCandidateReference(refs, value);
    }
    collectMediaRefs(value, refs);
  }
}

function extractContentMediaRefs(body, explicitMediaIds = []) {
  const refs = new Set();
  addCandidateReference(refs, explicitMediaIds);

  const structuredBody = parseStructuredBody(body);
  if (structuredBody) {
    collectMediaRefs(structuredBody, refs);
  }

  return [...refs];
}

module.exports = {
  extractContentMediaRefs,
  parseStructuredBody,
};
