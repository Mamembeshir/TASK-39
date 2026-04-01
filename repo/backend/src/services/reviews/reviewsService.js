function createReviewsService(deps) {
  const {
    ALLOWED_MEDIA_MIME,
    assertCanSubmitReviewForOrder,
    containsSensitiveTerms,
    createError,
    MAX_REVIEW_IMAGES,
    MAX_UPLOAD_BYTES,
    ObjectId,
    parseObjectIdOrNull,
    REVIEW_TAG_IDS,
    reviewsRepository,
    toOrgTimezoneDate,
    writeAuditLog,
  } = deps;

  return {
    createReview: async ({ auth, body }) => {
      const { orderId, rating, tags, text, mediaIds } = body || {};
      const parsedOrderId = parseObjectIdOrNull(orderId);
      if (!parsedOrderId) {
        throw createError(400, "INVALID_ORDER_ID", "orderId must be valid");
      }
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw createError(400, "INVALID_RATING", "rating must be an integer between 1 and 5");
      }
      if (!Array.isArray(tags) || tags.some((tag) => !REVIEW_TAG_IDS.includes(tag))) {
        throw createError(400, "INVALID_REVIEW_TAGS", "tags must use predefined review tag ids");
      }
      if (typeof text !== "string" || text.trim().length === 0) {
        throw createError(400, "INVALID_REVIEW_TEXT", "text is required");
      }
      if (!Array.isArray(mediaIds) || mediaIds.length > MAX_REVIEW_IMAGES) {
        throw createError(400, "INVALID_MEDIA_COUNT", "mediaIds must be an array with up to six items");
      }

      const parsedMediaIds = mediaIds.map((id) => parseObjectIdOrNull(id));
      if (parsedMediaIds.some((id) => !id)) {
        throw createError(400, "INVALID_MEDIA_ID", "mediaIds must contain valid ids");
      }

      const settings = await reviewsRepository.findSettings();
      const orgTimezone = settings?.organizationTimezone || "America/Los_Angeles";
      const order = await reviewsRepository.findOrderById(parsedOrderId);

      try {
        assertCanSubmitReviewForOrder(auth, order);
      } catch (error) {
        throw createError(404, "ORDER_NOT_FOUND", "Order was not found");
      }
      if (!order) {
        throw createError(404, "ORDER_NOT_FOUND", "Order was not found");
      }
      if (order.state !== "completed" || !order.completedAt) {
        throw createError(400, "ORDER_NOT_ELIGIBLE", "Only completed orders can be reviewed");
      }

      const completedLocal = toOrgTimezoneDate(new Date(order.completedAt), orgTimezone);
      const windowEndsLocal = new Date(completedLocal);
      windowEndsLocal.setDate(windowEndsLocal.getDate() + 14);
      windowEndsLocal.setHours(23, 59, 59, 999);
      const nowLocal = toOrgTimezoneDate(new Date(), orgTimezone);
      if (nowLocal.getTime() > windowEndsLocal.getTime()) {
        throw createError(400, "REVIEW_WINDOW_EXPIRED", "Review window has expired");
      }

      const mediaDocs = await reviewsRepository.findMediaByIds(parsedMediaIds);
      if (mediaDocs.length !== parsedMediaIds.length) {
        throw createError(400, "MEDIA_NOT_FOUND", "One or more media files were not found");
      }
      for (const media of mediaDocs) {
        if (media.purpose !== "review") {
          throw createError(400, "INVALID_MEDIA_PURPOSE", "Only review media can be attached to reviews");
        }
        if (!ALLOWED_MEDIA_MIME[media.mime] || Number(media.byteSize) > MAX_UPLOAD_BYTES) {
          throw createError(400, "INVALID_MEDIA_FILE", "Review media must be an allowed image up to 10 MB");
        }
      }

      const serviceIdsSet = new Set();
      const bundleIds = [];
      for (const line of order.lineItems || []) {
        if (line?.type === "service" && line.serviceId) {
          serviceIdsSet.add(line.serviceId.toString());
        }
        if (line?.type === "bundle" && line.bundleId) {
          bundleIds.push(line.bundleId);
        }
      }

      const bundles = await reviewsRepository.findBundlesByIds(bundleIds.map((id) => new ObjectId(id)));
      for (const bundle of bundles) {
        for (const serviceId of bundle.serviceIds || []) {
          serviceIdsSet.add(serviceId.toString());
        }
      }

      const hasSensitive = containsSensitiveTerms(text, settings?.sensitiveTerms || []);
      const status = hasSensitive ? "quarantined" : "approved";

      try {
        const result = await reviewsRepository.insertReview({
          orderId: parsedOrderId,
          serviceIds: [...serviceIdsSet].map((id) => new ObjectId(id)),
          customerId: new ObjectId(auth.sub),
          verified: true,
          status,
          text: text.trim(),
          rating,
          tags,
          mediaIds: parsedMediaIds,
          moderation: {
            quarantinedByTerms: hasSensitive,
            reason: hasSensitive ? "sensitive_terms_match" : null,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        return { id: result.insertedId.toString(), status };
      } catch (error) {
        if (error && error.code === 11000) {
          throw createError(409, "REVIEW_ALREADY_EXISTS", "A review already exists for this order");
        }
        throw error;
      }
    },

    approveReviewById: async ({ auth, req, reviewId }) => {
      const updated = await reviewsRepository.moderateReview(reviewId, {
        status: "approved",
        moderatedBy: new ObjectId(auth.sub),
        moderatedAt: new Date(),
        moderationDecision: "approved",
        updatedAt: new Date(),
      });
      if (updated.matchedCount === 0) {
        throw createError(404, "REVIEW_NOT_FOUND", "Review not found");
      }

      await writeAuditLog({
        username: auth?.username,
        userId: auth?.sub ? new ObjectId(auth.sub) : null,
        action: "moderation.review.approve",
        outcome: "success",
        req,
      });
      return { status: "approved" };
    },

    rejectReviewById: async ({ auth, req, reviewId }) => {
      const updated = await reviewsRepository.moderateReview(reviewId, {
        status: "rejected",
        moderatedBy: new ObjectId(auth.sub),
        moderatedAt: new Date(),
        moderationDecision: "rejected",
        updatedAt: new Date(),
      });
      if (updated.matchedCount === 0) {
        throw createError(404, "REVIEW_NOT_FOUND", "Review not found");
      }

      await writeAuditLog({
        username: auth?.username,
        userId: auth?.sub ? new ObjectId(auth.sub) : null,
        action: "moderation.review.reject",
        outcome: "success",
        req,
      });
      return { status: "rejected" };
    },

    listModerationQueue: async ({ auth }) => {
      void auth;
      const reviews = await reviewsRepository.findReviewsByStatus("quarantined");
      return reviews.map((review) => ({
        id: review._id.toString(),
        orderId: review.orderId.toString(),
        status: review.status,
        text: String(review.text || ""),
        rating: review.rating,
        createdAt: review.createdAt,
      }));
    },
  };
}

module.exports = {
  createReviewsService,
};
