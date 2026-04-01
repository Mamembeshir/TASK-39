function assessLoginRisk({
  isNewDevice = false,
  knownDeviceCount = 0,
  recentFailureCount = 0,
  hasIpAddress = true,
  hasUserAgent = true,
} = {}) {
  let score = 0;

  if (isNewDevice) {
    score += knownDeviceCount > 0 ? 60 : 25;
    if (knownDeviceCount >= 3) {
      score += 5;
    }
  }

  if (recentFailureCount >= 3) {
    score += 25;
  } else if (recentFailureCount > 0) {
    score += 10;
  }

  if (!hasIpAddress) {
    score += 10;
  }

  if (!hasUserAgent) {
    score += 5;
  }

  const boundedScore = Math.min(score, 100);
  let category = "low";
  let recommendedAction = "allow";

  if (boundedScore >= 70) {
    category = "high";
    recommendedAction = "step_up";
  } else if (boundedScore >= 40) {
    category = "medium";
    recommendedAction = "notify";
  }

  return {
    score: boundedScore,
    category,
    recommendedAction,
  };
}

function createAuditService({ getDatabase, getClientIp }) {
  return {
    assessLoginRisk,
    writeAuditLog: async ({ username, userId, action, outcome, req, isNewDevice = false, riskAssessment = null }) => {
      try {
        const database = getDatabase();
        await database.collection("audit_logs").insertOne({
          who: userId || null,
          action,
          when: new Date(),
          metadata: {
            username: username || null,
            ip: getClientIp(req),
            userAgent: req.headers["user-agent"] || "unknown",
            outcome,
            isNewDevice,
            risk: riskAssessment,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } catch (error) {
        console.error(`Failed to write audit log: ${error.message}`);
      }
    },
  };
}

module.exports = {
  assessLoginRisk,
  createAuditService,
};
