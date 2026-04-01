function createOrdersController(deps) {
  const { createError, decryptField, hasRole, maskAddress, maskPhone, ordersService } = deps;

  return {
    createOrder: async (req, res, next) => {
      try {
        const result = await ordersService.createOrder({
          authSub: req.auth.sub,
          ObjectId: deps.ObjectId,
          payload: {
            ...req.body,
            parseObjectIdOrNull: deps.parseObjectIdOrNull,
          },
        });

        return res.status(result.status).json(result.body);
      } catch (error) {
        return next(error);
      }
    },

    getOrderById: async (req, res, next) => {
      try {
        const orderId = deps.parseObjectIdOrNull(req.params.id);
        if (!orderId) {
          return next(createError(400, "INVALID_ORDER_ID", "Order id is invalid"));
        }

        const isPrivileged = hasRole(req, deps.STAFF_ROLES) || hasRole(req, ["administrator", "moderator"]);

        const result = await ordersService.getOrderById({
          auth: req.auth,
          decryptField,
          isPrivileged,
          maskAddress,
          maskPhone,
          orderId,
        });

        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },

    listOrders: async (req, res, next) => {
      try {
        const result = await ordersService.listOrdersForUser({
          auth: req.auth,
          ObjectId: deps.ObjectId,
        });

        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },

    cancelOrderById: async (req, res, next) => {
      try {
        const orderId = deps.parseObjectIdOrNull(req.params.id);
        if (!orderId) {
          return next(createError(400, "INVALID_ORDER_ID", "Order id is invalid"));
        }

        const result = await ordersService.cancelOrderById({
          auth: req.auth,
          ObjectId: deps.ObjectId,
          orderId,
          req,
          writeAuditLog: deps.writeAuditLog,
        });

        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },

    completeOrderById: async (req, res, next) => {
      try {
        const orderId = deps.parseObjectIdOrNull(req.params.id);
        if (!orderId) {
          return next(createError(400, "INVALID_ORDER_ID", "Order id is invalid"));
        }

        const result = await ordersService.completeOrderById({
          auth: req.auth,
          ObjectId: deps.ObjectId,
          orderId,
          req,
          writeAuditLog: deps.writeAuditLog,
        });

        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },

    listCapacitySlots: async (req, res, next) => {
      try {
        const result = await ordersService.listCapacitySlots();
        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },

    createCapacitySlot: async (req, res, next) => {
      try {
        const result = await ordersService.createCapacitySlot({
          payload: req.body,
          ObjectId: deps.ObjectId,
          parseObjectIdOrNull: deps.parseObjectIdOrNull,
        });
        return res.status(201).json(result);
      } catch (error) {
        return next(error);
      }
    },

    updateCapacitySlot: async (req, res, next) => {
      try {
        const result = await ordersService.updateCapacitySlot({
          slotId: req.params.id,
          payload: req.body,
          parseObjectIdOrNull: deps.parseObjectIdOrNull,
        });
        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },

    deleteCapacitySlot: async (req, res, next) => {
      try {
        const result = await ordersService.deleteCapacitySlot({
          slotId: req.params.id,
          parseObjectIdOrNull: deps.parseObjectIdOrNull,
        });
        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },
  };
}

module.exports = {
  createOrdersController,
};
