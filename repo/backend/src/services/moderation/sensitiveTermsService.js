const BOUNDARY_CLASS = "[^\\p{L}\\p{N}]";
const compiledTermsCache = new Map();

function normalizeForSensitiveTermMatch(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compileSensitiveTerms(terms) {
  if (!Array.isArray(terms) || terms.length === 0) {
    return [];
  }

  const normalizedTerms = [...new Set(
    terms.map((term) => normalizeForSensitiveTermMatch(term).trim()).filter(Boolean),
  )].sort();
  const cacheKey = normalizedTerms.join("\u0000");
  if (compiledTermsCache.has(cacheKey)) {
    return compiledTermsCache.get(cacheKey);
  }

  const compiled = normalizedTerms.map((term) => {
    const pattern = escapeRegex(term).replace(/\s+/g, "\\s+");
    return new RegExp(`(^|${BOUNDARY_CLASS})(${pattern})(?=$|${BOUNDARY_CLASS})`, "u");
  });
  compiledTermsCache.set(cacheKey, compiled);
  return compiled;
}

function containsSensitiveTerms(text, terms) {
  if (!text || !Array.isArray(terms) || terms.length === 0) {
    return false;
  }

  const normalizedText = normalizeForSensitiveTermMatch(text);
  return compileSensitiveTerms(terms).some((pattern) => pattern.test(normalizedText));
}

module.exports = {
  compileSensitiveTerms,
  containsSensitiveTerms,
  normalizeForSensitiveTermMatch,
};
