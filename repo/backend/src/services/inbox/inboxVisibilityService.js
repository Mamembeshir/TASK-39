function buildInboxVisibilityFilter(userId, roles, now) {
  return {
    publishAt: { $lte: now },
    $or: [
      { recipientUserId: userId },
      { roles: { $exists: false } },
      { roles: { $size: 0 } },
      { roles: { $in: roles } },
      { roleTargets: { $in: roles } },
    ],
  };
}

module.exports = {
  buildInboxVisibilityFilter,
};
