const { z } = require("zod");
const { validationError } = require("./errorHandler");

const plainRecordSchema = z.record(z.any());

function collectUnsafeKeys(value, parentPath = "") {
  if (!value || typeof value !== "object") {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectUnsafeKeys(item, `${parentPath}[${index}]`));
  }

  const keys = Object.keys(value);
  const errors = [];
  for (const key of keys) {
    const keyPath = parentPath ? `${parentPath}.${key}` : key;
    if (key.startsWith("$") || key.includes(".")) {
      errors.push({ field: keyPath, message: "Operator-like keys are not allowed" });
    }
    errors.push(...collectUnsafeKeys(value[key], keyPath));
  }
  return errors;
}

function validateRequestShape(req, res, next) {
  const details = [];

  const paramsResult = plainRecordSchema.safeParse(req.params || {});
  if (!paramsResult.success) {
    details.push({ field: "params", message: "Invalid params object" });
  }

  const queryResult = plainRecordSchema.safeParse(req.query || {});
  if (!queryResult.success) {
    details.push({ field: "query", message: "Invalid query object" });
  }

  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body !== "object") {
      details.push({ field: "body", message: "Body must be an object" });
    }
  }

  details.push(...collectUnsafeKeys(req.params || {}, "params"));
  details.push(...collectUnsafeKeys(req.query || {}, "query"));
  details.push(...collectUnsafeKeys(req.body || {}, "body"));

  if (details.length > 0) {
    return next(validationError(details));
  }
  return next();
}

function validate(schemas) {
  return (req, res, next) => {
    const details = [];

    if (schemas.params) {
      const parsed = schemas.params.safeParse(req.params || {});
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          details.push({ field: `params.${issue.path.join(".") || "root"}`, message: issue.message });
        }
      }
    }

    if (schemas.query) {
      const parsed = schemas.query.safeParse(req.query || {});
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          details.push({ field: `query.${issue.path.join(".") || "root"}`, message: issue.message });
        }
      }
    }

    if (schemas.body) {
      const parsed = schemas.body.safeParse(req.body || {});
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          details.push({ field: `body.${issue.path.join(".") || "root"}`, message: issue.message });
        }
      }
    }

    if (details.length > 0) {
      return next(validationError(details));
    }

    return next();
  };
}

module.exports = {
  validateRequestShape,
  validate,
};
