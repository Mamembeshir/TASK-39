function createEnforceBlacklist({ createError, getClientIp, getDatabase }) {
  return async function enforceBlacklist(req, res, next) {
    try {
      const database = getDatabase();
      const ip = getClientIp(req);
      const userId = req.auth?.sub || null;

      const blocked = await database.collection("blacklists").findOne({
        active: true,
        $or: [{ type: "ip", value: ip }, ...(userId ? [{ type: "user", value: userId }] : [])],
      });

      if (blocked) {
        return next(createError(403, "BLACKLISTED", "Access denied"));
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = {
  createEnforceBlacklist,
};
