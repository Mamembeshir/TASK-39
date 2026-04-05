function createAdminController(deps) {
  const { createError, getDatabase, ObjectId, writeAuditLog } = deps;

  return {
    listAuditLogs: async (req, res, next) => {
      try {
        const database = getDatabase();
        const logs = await database
          .collection("audit_logs")
          .find({}, { projection: { who: 1, action: 1, when: 1, metadata: 1 } })
          .sort({ when: -1 })
          .limit(100)
          .toArray();
        return res.status(200).json(logs.map((log) => ({ ...log, id: log._id.toString(), who: log.who?.toString?.() || null })));
      } catch (error) {
        return next(error);
      }
    },

    listBlacklist: async (req, res, next) => {
      try {
        const database = getDatabase();
        const items = await database.collection("blacklists").find({}).sort({ updatedAt: -1 }).toArray();
        return res.status(200).json(items.map((item) => ({ id: item._id?.toString?.() || `${item.type}:${item.value}`, type: item.type, value: item.value, active: Boolean(item.active), createdAt: item.createdAt, updatedAt: item.updatedAt })));
      } catch (error) {
        return next(error);
      }
    },

    upsertBlacklist: async (req, res, next) => {
      try {
        const type = typeof req.body?.type === 'string' ? req.body.type.trim() : '';
        const value = typeof req.body?.value === 'string' ? req.body.value.trim() : '';
        const active = Boolean(req.body?.active);
        if (!['ip', 'user'].includes(type) || !value) {
          return next(createError(400, 'INVALID_BLACKLIST', 'type must be ip|user and value is required'));
        }
        const database = getDatabase();
        await database.collection('blacklists').updateOne(
          { type, value },
          { $set: { active, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
          { upsert: true },
        );

        await writeAuditLog({
          username: req.auth?.username,
          userId: req.auth?.sub ? new ObjectId(req.auth.sub) : null,
          action: 'admin.blacklist.upsert',
          outcome: 'success',
          req,
          details: { type, value, active },
        });

        return res.status(200).json({ status: 'ok' });
      } catch (error) {
        return next(error);
      }
    },
  };
}

module.exports = {
  createAdminController,
};
