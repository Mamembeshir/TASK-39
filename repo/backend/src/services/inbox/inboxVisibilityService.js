function buildInboxVisibilityFilter(userId, roles, now) {
  const roleValues = Array.isArray(roles) ? roles : [];

  return {
    publishAt: { $lte: now },
    $or: [
      { recipientUserId: userId },
      {
        recipientUserId: null,
        $or: [
          { roles: { $exists: false } },
          { roles: { $size: 0 } },
          { roles: { $in: roleValues } },
          { roleTargets: { $in: roleValues } },
        ],
      },
    ],
  };
}

module.exports = {
  buildInboxVisibilityFilter,
};
