const { getBundleComponents, getBundleServiceIds } = require("../../repositories/bundleRepository");

function createCatalogService(deps) {
  const {
    catalogRepository,
    createError,
    hasRole,
    normalizeBundlePayload,
    normalizeServicePayload,
    ObjectId,
    parseObjectIdOrNull,
    parseTagsQuery,
    STAFF_ROLES,
    syncServiceSearchDocument,
    writeAuditLog,
  } = deps;

  return {
    listServices: async ({ query, req }) => {
      const tags = parseTagsQuery(query.tags);
      const category = query.category ? String(query.category) : null;
      const duration = query.duration ? Number(query.duration) : null;
      const addOn = query.addOn ? String(query.addOn) : null;
      const includeUnpublished = query.includeUnpublished === "true" && hasRole(req, STAFF_ROLES);

      const filter = {};
      if (!includeUnpublished) {
        filter.published = true;
      }
      if (category) {
        filter.category = category;
      }
      if (tags.length > 0) {
        filter.tags = { $all: tags };
      }
      if (!Number.isNaN(duration) && duration > 0) {
        filter["specDefinitions.durationMinutes"] = duration;
      }
      if (addOn) {
        filter.addOns = addOn;
      }

      const services = await catalogRepository.findServices(filter);
      return {
        services: services.map((service) => ({
          ...service,
          id: service._id.toString(),
        })),
      };
    },

    search: async ({ query }) => {
      const q = typeof query.q === "string" ? query.q.trim() : "";
      if (!q) {
        return { results: [] };
      }

      const docs = await catalogRepository.searchDocuments(q, new Date());
      return {
        results: docs.map((doc) => ({
          type: doc.type,
          id: doc.sourceId.toString(),
          title: doc.title,
          snippet: doc.body,
          tags: doc.tags || [],
        })),
      };
    },

    getServiceById: async ({ id, req }) => {
      const serviceId = parseObjectIdOrNull(id);
      if (!serviceId) {
        throw createError(400, "INVALID_SERVICE_ID", "Service id is invalid");
      }

      const service = await catalogRepository.findServiceById(serviceId);
      if (!service || (!service.published && !hasRole(req, STAFF_ROLES))) {
        throw createError(404, "SERVICE_NOT_FOUND", "Service not found");
      }

      const bundles = await catalogRepository.findBundlesByIds(service.bundleIds || []);
      const bundleServiceIds = [...new Set(bundles.flatMap((bundle) => getBundleServiceIds(bundle).map((id) => id.toString())))]
        .map((id) => parseObjectIdOrNull(id))
        .filter(Boolean);
      const bundleServices = bundleServiceIds.length ? await catalogRepository.findServices({ _id: { $in: bundleServiceIds } }) : [];
      const bundleServicesById = Object.fromEntries(bundleServices.map((item) => [item._id.toString(), item]));
      return {
        service: {
          ...service,
          id: service._id.toString(),
          bundles: bundles
            .filter((bundle) => bundle.published || hasRole(req, STAFF_ROLES))
            .map((bundle) => ({
              id: bundle._id.toString(),
              title: bundle.title,
              description: bundle.description,
              published: bundle.published,
              pricing: bundle.pricing,
              services: getBundleComponents(bundle).map((component) => {
                const bundleServiceId = component.serviceId;
                const relatedService = bundleServicesById[bundleServiceId.toString()];
                return {
                  id: bundleServiceId.toString(),
                  title: relatedService?.title || bundleServiceId.toString(),
                  category: relatedService?.category || null,
                  durationMinutes: component?.spec?.durationMinutes || null,
                  headcount: component?.spec?.headcount || null,
                  toolsMode: component?.spec?.toolsMode || null,
                  addOnIds: component?.spec?.addOnIds || [],
                };
              }),
            })),
        },
      };
    },

    listServiceQuestions: async ({ id }) => {
      const serviceId = parseObjectIdOrNull(id);
      if (!serviceId) {
        throw createError(400, "INVALID_SERVICE_ID", "Service id is invalid");
      }

      const service = await catalogRepository.findPublishedServiceById(serviceId);
      if (!service) {
        throw createError(404, "SERVICE_NOT_FOUND", "Service not found");
      }

      const questions = await catalogRepository.findServiceQuestions(serviceId);
      return {
        questions: questions.map((item) => ({
          id: item._id.toString(),
          question: item.question,
          answer: item.answer,
        })),
      };
    },

    createServiceQuestion: async ({ id, body, auth, ObjectId }) => {
      const serviceId = parseObjectIdOrNull(id);
      if (!serviceId) {
        throw createError(400, "INVALID_SERVICE_ID", "Service id is invalid");
      }

      const service = await catalogRepository.findPublishedServiceById(serviceId);
      if (!service) {
        throw createError(404, "SERVICE_NOT_FOUND", "Service not found");
      }

      const question = typeof body?.question === "string" ? body.question.trim() : "";
      if (!question) {
        throw createError(400, "INVALID_QUESTION", "question is required");
      }

      const now = new Date();
      const result = await catalogRepository.insertServiceQuestion({
        serviceId,
        question,
        answer: null,
        status: "pending_moderation",
        createdBy: auth?.sub ? new ObjectId(auth.sub) : null,
        answeredBy: null,
        createdAt: now,
        updatedAt: now,
      });

      return {
        id: result.insertedId.toString(),
        status: "pending_moderation",
      };
    },

    listPendingServiceQuestions: async () => {
      const questions = await catalogRepository.findPendingServiceQuestions();
      return {
        questions: questions.map((item) => ({
          id: item._id.toString(),
          serviceId: item.serviceId?.toString?.() || null,
          question: item.question,
          createdAt: item.createdAt,
        })),
      };
    },

    publishServiceQuestionById: async ({ id, body, auth, ObjectId }) => {
      const questionId = parseObjectIdOrNull(id);
      if (!questionId) {
        throw createError(400, "INVALID_QUESTION_ID", "Question id is invalid");
      }

      const question = await catalogRepository.findServiceQuestionById(questionId);
      if (!question) {
        throw createError(404, "QUESTION_NOT_FOUND", "Question not found");
      }

      const answer = typeof body?.answer === "string" ? body.answer.trim() : "";
      if (!answer) {
        throw createError(400, "INVALID_ANSWER", "answer is required");
      }

      await catalogRepository.updateServiceQuestionById(questionId, {
        answer,
        status: "published",
        answeredBy: auth?.sub ? new ObjectId(auth.sub) : null,
        updatedAt: new Date(),
      });

      return { id: questionId.toString(), status: "published" };
    },

    rejectServiceQuestionById: async ({ id }) => {
      const questionId = parseObjectIdOrNull(id);
      if (!questionId) {
        throw createError(400, "INVALID_QUESTION_ID", "Question id is invalid");
      }

      const question = await catalogRepository.findServiceQuestionById(questionId);
      if (!question) {
        throw createError(404, "QUESTION_NOT_FOUND", "Question not found");
      }

      await catalogRepository.updateServiceQuestionById(questionId, {
        status: "rejected",
        updatedAt: new Date(),
      });

      return { id: questionId.toString(), status: "rejected" };
    },

    listServiceReviews: async ({ id }) => {
      const serviceId = parseObjectIdOrNull(id);
      if (!serviceId) {
        throw createError(400, "INVALID_SERVICE_ID", "Service id is invalid");
      }

      const reviews = await catalogRepository.findServiceReviews(serviceId);
      return {
        reviews: reviews.map((review) => ({
          id: review._id.toString(),
          orderId: review.orderId.toString(),
          rating: review.rating,
          text: review.text,
          tags: review.tags,
          mediaIds: (review.mediaIds || []).map((mediaId) => mediaId.toString()),
          createdAt: review.createdAt,
        })),
      };
    },

    createService: async ({ body }) => {
      const normalized = normalizeServicePayload(body || {}, { partial: false });
      if (!normalized.ok) {
        throw createError(400, "INVALID_SPEC", normalized.errors.join("; "));
      }

      const now = new Date();
      const toInsert = {
        ...normalized.document,
        published: normalized.document.published ?? false,
        createdAt: now,
        updatedAt: now,
      };

      const result = await catalogRepository.insertService(toInsert);
      await syncServiceSearchDocument(result.insertedId);
      return { id: result.insertedId.toString() };
    },

    updateServiceById: async ({ id, body }) => {
      const serviceId = parseObjectIdOrNull(id);
      if (!serviceId) {
        throw createError(400, "INVALID_SERVICE_ID", "Service id is invalid");
      }

      const normalized = normalizeServicePayload(body || {}, { partial: true });
      if (!normalized.ok) {
        throw createError(400, "INVALID_SPEC", normalized.errors.join("; "));
      }
      if (Object.keys(normalized.document).length === 0) {
        throw createError(400, "EMPTY_UPDATE", "No valid fields provided for update");
      }

      const result = await catalogRepository.updateServiceById(serviceId, {
        ...normalized.document,
        updatedAt: new Date(),
      });
      if (result.matchedCount === 0) {
        throw createError(404, "SERVICE_NOT_FOUND", "Service not found");
      }

      await syncServiceSearchDocument(serviceId);
      return { status: "ok" };
    },

    publishServiceById: async ({ auth, id, req }) => {
      const serviceId = parseObjectIdOrNull(id);
      if (!serviceId) {
        throw createError(400, "INVALID_SERVICE_ID", "Service id is invalid");
      }

      const result = await catalogRepository.updateServiceById(serviceId, {
        published: true,
        updatedAt: new Date(),
      });
      if (result.matchedCount === 0) {
        throw createError(404, "SERVICE_NOT_FOUND", "Service not found");
      }

      await syncServiceSearchDocument(serviceId);
      await writeAuditLog({
        username: auth?.username,
        userId: auth?.sub ? new ObjectId(auth.sub) : null,
        action: "catalog.service.publish",
        outcome: "success",
        req,
      });
      return { status: "ok" };
    },

    unpublishServiceById: async ({ auth, id, req }) => {
      const serviceId = parseObjectIdOrNull(id);
      if (!serviceId) {
        throw createError(400, "INVALID_SERVICE_ID", "Service id is invalid");
      }

      const result = await catalogRepository.updateServiceById(serviceId, {
        published: false,
        updatedAt: new Date(),
      });
      if (result.matchedCount === 0) {
        throw createError(404, "SERVICE_NOT_FOUND", "Service not found");
      }

      await syncServiceSearchDocument(serviceId);
      await writeAuditLog({
        username: auth?.username,
        userId: auth?.sub ? new ObjectId(auth.sub) : null,
        action: "catalog.service.unpublish",
        outcome: "success",
        req,
      });
      return { status: "ok" };
    },

    createBundle: async ({ body }) => {
      const normalized = normalizeBundlePayload(body || {}, { partial: false });
      if (!normalized.ok) {
        throw createError(400, "INVALID_BUNDLE", normalized.errors.join("; "));
      }

      const now = new Date();
      const toInsert = {
        ...normalized.document,
        published: normalized.document.published ?? false,
        createdAt: now,
        updatedAt: now,
      };

      const result = await catalogRepository.insertBundle(toInsert);
      return { id: result.insertedId.toString() };
    },

    updateBundleById: async ({ id, body }) => {
      const bundleId = parseObjectIdOrNull(id);
      if (!bundleId) {
        throw createError(400, "INVALID_BUNDLE_ID", "Bundle id is invalid");
      }

      const normalized = normalizeBundlePayload(body || {}, { partial: true });
      if (!normalized.ok) {
        throw createError(400, "INVALID_BUNDLE", normalized.errors.join("; "));
      }
      if (Object.keys(normalized.document).length === 0) {
        throw createError(400, "EMPTY_UPDATE", "No valid fields provided for update");
      }

      const result = await catalogRepository.updateBundleById(bundleId, {
        ...normalized.document,
        updatedAt: new Date(),
      });
      if (result.matchedCount === 0) {
        throw createError(404, "BUNDLE_NOT_FOUND", "Bundle not found");
      }

      return { status: "ok" };
    },

    publishBundleById: async ({ auth, id, req }) => {
      const bundleId = parseObjectIdOrNull(id);
      if (!bundleId) {
        throw createError(400, "INVALID_BUNDLE_ID", "Bundle id is invalid");
      }

      const result = await catalogRepository.updateBundleById(bundleId, {
        published: true,
        updatedAt: new Date(),
      });
      if (result.matchedCount === 0) {
        throw createError(404, "BUNDLE_NOT_FOUND", "Bundle not found");
      }

      await writeAuditLog({
        username: auth?.username,
        userId: auth?.sub ? new ObjectId(auth.sub) : null,
        action: "catalog.bundle.publish",
        outcome: "success",
        req,
      });
      return { status: "ok" };
    },

    unpublishBundleById: async ({ auth, id, req }) => {
      const bundleId = parseObjectIdOrNull(id);
      if (!bundleId) {
        throw createError(400, "INVALID_BUNDLE_ID", "Bundle id is invalid");
      }

      const result = await catalogRepository.updateBundleById(bundleId, {
        published: false,
        updatedAt: new Date(),
      });
      if (result.matchedCount === 0) {
        throw createError(404, "BUNDLE_NOT_FOUND", "Bundle not found");
      }

      await writeAuditLog({
        username: auth?.username,
        userId: auth?.sub ? new ObjectId(auth.sub) : null,
        action: "catalog.bundle.unpublish",
        outcome: "success",
        req,
      });
      return { status: "ok" };
    },
  };
}

module.exports = {
  createCatalogService,
};
