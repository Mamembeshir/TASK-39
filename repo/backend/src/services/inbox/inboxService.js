function createInboxService(deps) {
  const { buildInboxVisibilityFilter, createError, messagesRepository } = deps;

  return {
    createStaffMessage: async ({ auth, payload, ObjectId, parseObjectIdOrNull }) => {
      const { title, body, publishAt, roles, recipientUserId } = payload;
      if (!title || typeof title !== "string") {
        throw createError(400, "INVALID_TITLE", "title is required");
      }
      if (!body || typeof body !== "string") {
        throw createError(400, "INVALID_BODY", "body is required");
      }

      const allowedRoles = ["customer", "administrator", "service_manager", "moderator"];
      const targetRoles = roles === undefined ? [] : roles;
      if (!Array.isArray(targetRoles) || targetRoles.some((role) => !allowedRoles.includes(role))) {
        throw createError(400, "INVALID_ROLES", "roles must be an array of known role ids");
      }

      const publishAtDate = publishAt ? new Date(publishAt) : new Date();
      if (Number.isNaN(publishAtDate.getTime())) {
        throw createError(400, "INVALID_PUBLISH_AT", "publishAt must be a valid ISO datetime");
      }

      const parsedRecipientUserId = recipientUserId ? parseObjectIdOrNull(recipientUserId) : null;
      if (recipientUserId && !parsedRecipientUserId) {
        throw createError(400, "INVALID_RECIPIENT", "recipientUserId must be a valid id");
      }

      const result = await messagesRepository.insertMessage({
        type: "announcement",
        title: title.trim(),
        body: body.trim(),
        publishAt: publishAtDate,
        roles: targetRoles,
        roleTargets: targetRoles,
        recipientUserId: parsedRecipientUserId,
        readByUserIds: [],
        createdBy: new ObjectId(auth.sub),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return { id: result.insertedId.toString() };
    },

    listInbox: async ({ auth, ObjectId }) => {
      const now = new Date();
      const userId = new ObjectId(auth.sub);
      const roles = auth.roles || [];

      const messages = await messagesRepository.listMessages(buildInboxVisibilityFilter(userId, roles, now));
      return {
        messages: messages.map((message) => ({
          id: message._id.toString(),
          title: message.title,
          body: message.body,
          publishAt: message.publishAt,
          roles: message.roles || message.roleTargets || [],
          isRead: (message.readByUserIds || []).some((id) => id.toString() === auth.sub),
        })),
      };
    },

    markInboxRead: async ({ auth, messageId, ObjectId }) => {
      const userId = new ObjectId(auth.sub);
      const visibilityFilter = buildInboxVisibilityFilter(userId, auth.roles || [], new Date());
      const updated = await messagesRepository.markMessageRead(messageId, visibilityFilter, userId);
      if (!updated) {
        throw createError(404, "MESSAGE_NOT_FOUND", "Message not found");
      }
      return { status: "ok", isRead: true };
    },
  };
}

module.exports = {
  createInboxService,
};
