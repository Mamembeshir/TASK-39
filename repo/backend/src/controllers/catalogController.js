function createCatalogController(deps) {
  const { catalogService } = deps;

  return {
    listServices: async (req, res, next) => {
      try {
        const result = await catalogService.listServices({ query: req.query, req });
        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },

    search: async (req, res, next) => {
      try {
        const result = await catalogService.search({ query: req.query });
        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },

    getServiceById: async (req, res, next) => {
      try {
        const result = await catalogService.getServiceById({ id: req.params.id, req });
        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },

    listServiceQuestions: async (req, res, next) => {
      try {
        const result = await catalogService.listServiceQuestions({ id: req.params.id });
        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },

    createServiceQuestion: async (req, res, next) => {
      try {
        const result = await catalogService.createServiceQuestion({ id: req.params.id, body: req.body, auth: req.auth, ObjectId });
        return res.status(201).json(result);
      } catch (error) {
        return next(error);
      }
    },

    listPendingServiceQuestions: async (req, res, next) => {
      try {
        const result = await catalogService.listPendingServiceQuestions();
        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },

    publishServiceQuestionById: async (req, res, next) => {
      try {
        const result = await catalogService.publishServiceQuestionById({ id: req.params.id, body: req.body, auth: req.auth, ObjectId });
        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },

    rejectServiceQuestionById: async (req, res, next) => {
      try {
        const result = await catalogService.rejectServiceQuestionById({ id: req.params.id });
        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },

    listServiceReviews: async (req, res, next) => {
      try {
        const result = await catalogService.listServiceReviews({ id: req.params.id });
        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },

    createService: async (req, res, next) => {
      try {
        const result = await catalogService.createService({ body: req.body });
        return res.status(201).json(result);
      } catch (error) {
        return next(error);
      }
    },

    updateServiceById: async (req, res, next) => {
      try {
        const result = await catalogService.updateServiceById({ id: req.params.id, body: req.body });
        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },

    publishServiceById: async (req, res, next) => {
      try {
        const result = await catalogService.publishServiceById({
          auth: req.auth,
          id: req.params.id,
          req,
        });
        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },

    unpublishServiceById: async (req, res, next) => {
      try {
        const result = await catalogService.unpublishServiceById({
          auth: req.auth,
          id: req.params.id,
          req,
        });
        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },

    createBundle: async (req, res, next) => {
      try {
        const result = await catalogService.createBundle({ body: req.body });
        return res.status(201).json(result);
      } catch (error) {
        return next(error);
      }
    },

    updateBundleById: async (req, res, next) => {
      try {
        const result = await catalogService.updateBundleById({ id: req.params.id, body: req.body });
        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },

    publishBundleById: async (req, res, next) => {
      try {
        const result = await catalogService.publishBundleById({
          auth: req.auth,
          id: req.params.id,
          req,
        });
        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },

    unpublishBundleById: async (req, res, next) => {
      try {
        const result = await catalogService.unpublishBundleById({
          auth: req.auth,
          id: req.params.id,
          req,
        });
        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },
  };
}

module.exports = {
  createCatalogController,
};
