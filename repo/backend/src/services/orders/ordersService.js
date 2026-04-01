function createOrdersService(deps) {
  const {
    assertCanAccessOrder,
    buildQuoteFromRequestPayload,
    createError,
    createQuoteSignature,
    findAlternativeSlots,
    ordersRepository,
    releaseSlotCapacity,
  } = deps;

  async function listCapacitySlots() {
    const slots = await ordersRepository.listCapacitySlots();
    return slots.map((slot) => ({
      id: slot._id.toString(),
      serviceId: slot.serviceId?.toString?.() || null,
      startTime: slot.startTime,
      remainingCapacity: slot.remainingCapacity,
      createdAt: slot.createdAt,
      updatedAt: slot.updatedAt,
    }));
  }

  async function createCapacitySlot({ payload, ObjectId, parseObjectIdOrNull }) {
    const serviceId = parseObjectIdOrNull(payload?.serviceId);
    const startTime = new Date(payload?.startTime);
    const remainingCapacity = Number(payload?.remainingCapacity ?? 1);

    if (!serviceId) throw createError(400, "INVALID_SERVICE_ID", "serviceId is required and must be valid");
    if (Number.isNaN(startTime.getTime())) throw createError(400, "INVALID_START_TIME", "startTime must be a valid ISO datetime");
    if (!Number.isInteger(remainingCapacity) || remainingCapacity < 1) throw createError(400, "INVALID_CAPACITY", "remainingCapacity must be a positive integer");

    const now = new Date();
    const result = await ordersRepository.insertCapacitySlot({
      _id: new ObjectId(),
      serviceId,
      startTime,
      remainingCapacity,
      createdAt: now,
      updatedAt: now,
    });

    return { id: result.insertedId.toString() };
  }

  async function updateCapacitySlot({ slotId, payload, parseObjectIdOrNull }) {
    const parsedSlotId = parseObjectIdOrNull(slotId);
    const startTime = new Date(payload?.startTime);
    const remainingCapacity = Number(payload?.remainingCapacity ?? 1);

    if (!parsedSlotId) throw createError(400, "INVALID_SLOT_ID", "slotId must be valid");
    if (Number.isNaN(startTime.getTime())) throw createError(400, "INVALID_START_TIME", "startTime must be a valid ISO datetime");
    if (!Number.isInteger(remainingCapacity) || remainingCapacity < 1) throw createError(400, "INVALID_CAPACITY", "remainingCapacity must be a positive integer");

    const updated = await ordersRepository.updateCapacitySlot(parsedSlotId, { startTime, remainingCapacity, updatedAt: new Date() });
    if (updated.matchedCount === 0) throw createError(404, "SLOT_NOT_FOUND", "Slot not found");
    return { id: parsedSlotId.toString() };
  }

  async function deleteCapacitySlot({ slotId, parseObjectIdOrNull }) {
    const parsedSlotId = parseObjectIdOrNull(slotId);
    if (!parsedSlotId) throw createError(400, "INVALID_SLOT_ID", "slotId must be valid");
    const deleted = await ordersRepository.deleteCapacitySlot(parsedSlotId);
    if (deleted.deletedCount === 0) throw createError(404, "SLOT_NOT_FOUND", "Slot not found");
    return { status: 'ok' };
  }

  async function createOrder({ authSub, payload, ObjectId }) {
    const {
      lineItems,
      slotId,
      bookingRequestedAt,
      milesFromDepot,
      jurisdictionId,
      sameDayPriority,
      taxEnabled,
      quoteSignature,
      clientQuoteTotal,
      parseObjectIdOrNull,
    } = payload;

    const parsedSlotId = parseObjectIdOrNull(slotId);
    if (!parsedSlotId) {
      throw createError(400, "INVALID_SLOT_ID", "slotId is required and must be valid");
    }

    const slot = await ordersRepository.findCapacitySlotById(parsedSlotId);
    if (!slot) {
      throw createError(404, "SLOT_NOT_FOUND", "Requested slot was not found");
    }

    const slotStartIso = new Date(slot.startTime).toISOString();
    const quote = await buildQuoteFromRequestPayload({
      lineItems,
      slotStart: slotStartIso,
      bookingRequestedAt,
      milesFromDepot,
      jurisdictionId,
      sameDayPriority,
      taxEnabled,
    });

    if (quote.notServiceable) {
      return {
        status: 409,
        body: {
          code: "NOT_SERVICEABLE",
          message: "Requested location is outside the service area",
          quote,
        },
      };
    }

    const computedSignature = createQuoteSignature(quote);
    if (quoteSignature && quoteSignature !== computedSignature) {
      return {
        status: 409,
        body: {
          code: "QUOTE_CHANGED",
          message: "Quote has changed. Please refresh quote before placing order.",
          currentQuote: { ...quote, quoteSignature: computedSignature },
        },
      };
    }

    if (typeof clientQuoteTotal === "number" && Math.abs(clientQuoteTotal - quote.totals.total) > 0.01) {
      return {
        status: 409,
        body: {
          code: "QUOTE_CHANGED",
          message: "Quote total has changed. Please refresh quote before placing order.",
          currentQuote: { ...quote, quoteSignature: computedSignature },
        },
      };
    }

    const decrementedSlot = await ordersRepository.decrementCapacitySlot(parsedSlotId);
    if (!decrementedSlot) {
      const alternatives = await findAlternativeSlots(slot);
      return {
        status: 409,
        body: {
          code: "SLOT_UNAVAILABLE",
          message: "Requested slot is no longer available",
          alternatives,
        },
      };
    }

    const settings = await ordersRepository.findSettings();
    const pendingTimeoutMinutes = Number(settings?.pendingConfirmationTimeoutMinutes || 15);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + pendingTimeoutMinutes * 60 * 1000);

    try {
      const insertResult = await ordersRepository.insertOrder({
        customerId: new ObjectId(authSub),
        state: "pending_confirmation",
        lineItems,
        slotIds: [parsedSlotId],
        quoteSnapshot: quote,
        quoteSignature: computedSignature,
        pricingSnapshot: quote.totals,
        bookingRequestedAt: new Date(bookingRequestedAt),
        slotStart: new Date(slot.startTime),
        milesFromDepot: Number(milesFromDepot),
        jurisdictionId,
        expiresAt,
        capacityReleasedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      return {
        status: 201,
        body: {
          orderId: insertResult.insertedId.toString(),
          state: "pending_confirmation",
          expiresAt,
          quoteSignature: computedSignature,
        },
      };
    } catch (error) {
      await ordersRepository.incrementCapacitySlot(parsedSlotId);
      throw error;
    }
  }

  async function getOrderById({ auth, orderId, isPrivileged, decryptField, maskPhone, maskAddress }) {
    const order = await ordersRepository.findOrderById(orderId);
    try {
      assertCanAccessOrder(auth, order);
    } catch (error) {
      throw createError(404, "ORDER_NOT_FOUND", "Order not found");
    }

    if (!order) {
      throw createError(404, "ORDER_NOT_FOUND", "Order not found");
    }

    const customer = await ordersRepository.findUserById(order.customerId);
    const fullPhone = decryptField(customer?.phoneEncrypted);
    const fullAddress = decryptField(customer?.addressEncrypted);

    return {
      order: {
        id: order._id.toString(),
        state: order.state,
        lineItems: order.lineItems,
        pricingSnapshot: order.pricingSnapshot,
        customerContact: {
          phone: isPrivileged ? fullPhone : maskPhone(fullPhone),
          address: isPrivileged ? fullAddress : maskAddress(fullAddress),
        },
      },
    };
  }

  async function listOrdersForUser({ auth, ObjectId }) {
    const orders = await ordersRepository.findOrdersByCustomerId(new ObjectId(auth.sub));

    return orders.map((order) => ({
      id: order._id.toString(),
      state: order.state,
      total: order.pricingSnapshot?.total ?? null,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      slotStart: order.slotStart,
    }));
  }

  async function cancelOrderById({ auth, orderId, writeAuditLog, ObjectId, req }) {
    const order = await ordersRepository.findOrderById(orderId);
    try {
      assertCanAccessOrder(auth, order);
    } catch (error) {
      throw createError(404, "ORDER_NOT_FOUND", "Order not found");
    }

    if (!order) {
      throw createError(404, "ORDER_NOT_FOUND", "Order not found");
    }

    if (!["pending_confirmation", "confirmed"].includes(order.state)) {
      throw createError(409, "INVALID_ORDER_STATE", "Order cannot be cancelled from current state");
    }

    const now = new Date();
    const updated = await ordersRepository.cancelOrder(orderId, now);
    if (updated.modifiedCount === 0) {
      throw createError(409, "INVALID_ORDER_STATE", "Order could not be cancelled");
    }

    await releaseSlotCapacity(order.slotIds || []);
    await writeAuditLog({
      username: auth?.username,
      userId: auth?.sub ? new ObjectId(auth.sub) : null,
      action: "order.status.cancelled",
      outcome: "success",
      req,
    });

    return { status: "ok", state: "cancelled" };
  }

  async function completeOrderById({ auth, orderId, writeAuditLog, ObjectId, req }) {
    const updated = await ordersRepository.completeOrder(orderId);
    if (updated.modifiedCount === 0) {
      throw createError(409, "INVALID_ORDER_STATE", "Order cannot be completed from current state");
    }

    await writeAuditLog({
      username: auth?.username,
      userId: auth?.sub ? new ObjectId(auth.sub) : null,
      action: "order.status.completed",
      outcome: "success",
      req,
    });

    return { status: "ok", state: "completed" };
  }

  return {
    cancelOrderById,
    createCapacitySlot,
    deleteCapacitySlot,
    completeOrderById,
    createOrder,
    getOrderById,
    listCapacitySlots,
    listOrdersForUser,
    updateCapacitySlot,
  };
}

module.exports = {
  createOrdersService,
};
