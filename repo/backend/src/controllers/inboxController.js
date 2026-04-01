function createInboxController(deps) {
  const { createError, inboxService, ObjectId, parseObjectIdOrNull } = deps;

  return {
    createStaffMessage: async (req, res, next) => {
      try {
        const result = await inboxService.createStaffMessage({
          auth: req.auth,
          ObjectId,
          parseObjectIdOrNull,
          payload: req.body || {},
        });
        return res.status(201).json(result);
      } catch (error) {
        return next(error);
      }
    },

    listInbox: async (req, res, next) => {
      try {
        const result = await inboxService.listInbox({ auth: req.auth, ObjectId });
        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },

    markInboxRead: async (req, res, next) => {
      try {
        const messageId = parseObjectIdOrNull(req.params.id);
        if (!messageId) {
          return next(createError(400, "INVALID_MESSAGE_ID", "Message id is invalid"));
        }

        const result = await inboxService.markInboxRead({
          auth: req.auth,
          messageId,
          ObjectId,
        });

        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },
  };
}

module.exports = {
  createInboxController,
};
