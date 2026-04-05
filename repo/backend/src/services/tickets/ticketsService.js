function createTicketsService(deps) {
  const {
    assertCanAccessOrder,
    assertCanAccessTicket,
    computeSlaDeadlines,
    createError,
    ObjectId,
    ticketsRepository,
    SLA_FIRST_RESPONSE_MINUTES,
    SLA_RESOLUTION_MINUTES,
    writeAuditLog,
  } = deps;

  const CATEGORY_ROUTING = {
    billing: { team: "billing_ops", queue: "billing_queue" },
    scheduling: { team: "service_ops", queue: "dispatch_queue" },
    service_quality: { team: "service_ops", queue: "service_recovery_queue" },
    access_issue: { team: "service_ops", queue: "dispatch_queue" },
    general_support: { team: "customer_care", queue: "general_queue" },
    service_issue: { team: "service_ops", queue: "service_recovery_queue" },
    safety: { team: "trust_safety", queue: "safety_queue" },
    technical: { team: "platform_support", queue: "technical_queue" },
  };

  function resolveCategoryRouting(category) {
    return CATEGORY_ROUTING[category] || { team: "customer_care", queue: "general_queue" };
  }

  function isTicketStaff(auth) {
    return (
      Array.isArray(auth?.roles) &&
      (auth.roles.includes("administrator") || auth.roles.includes("service_manager") || auth.roles.includes("moderator"))
    );
  }

  const CUSTOMER_STATUS_TRANSITIONS = {
    open: ["open"],
    waiting_on_customer: ["open"],
  };

  const STAFF_STATUS_TRANSITIONS = {
    open: ["open", "waiting_on_customer"],
    waiting_on_customer: ["waiting_on_customer", "open"],
  };

  function normalizeStatus(status) {
    return typeof status === "string" ? status.trim().toLowerCase() : "";
  }

  function isMediaOwnedByActor(media, actorId) {
    if (!actorId || !media) {
      return false;
    }

    const createdBy = media.createdBy?.toString?.() || null;
    if (createdBy && createdBy === actorId) {
      return true;
    }

    if (Array.isArray(media.ownerIds)) {
      return media.ownerIds.some((ownerId) => (ownerId?.toString?.() || String(ownerId)) === actorId);
    }

    return false;
  }

  function hasAttachmentId(currentAttachmentIds, mediaId) {
    if (!Array.isArray(currentAttachmentIds)) {
      return false;
    }
    const normalizedId = mediaId?.toString?.() || String(mediaId);
    return currentAttachmentIds.some((attachmentId) => (attachmentId?.toString?.() || String(attachmentId)) === normalizedId);
  }

  function assertTicketAttachmentMedia({
    actorId,
    allowTicketExisting = false,
    currentAttachmentIds = [],
    mediaDocs,
  }) {
    for (const media of mediaDocs) {
      if (media?.purpose !== "ticket") {
        throw createError(400, "INVALID_ATTACHMENT_PURPOSE", "ticket attachments must use purpose=ticket");
      }

      const owned = isMediaOwnedByActor(media, actorId);
      const alreadyAttachedToTicket = allowTicketExisting && hasAttachmentId(currentAttachmentIds, media?._id);
      if (!owned && !alreadyAttachedToTicket) {
        throw createError(403, "MEDIA_FORBIDDEN", "One or more attachments are not owned by requester");
      }
    }
  }

  async function createTicket({ auth, headers, payload }) {
    const { orderId, category, description, attachmentIds, parseObjectIdOrNull } = payload;
    const parsedOrderId = parseObjectIdOrNull(orderId);
    if (!parsedOrderId) {
      throw createError(400, "ORDER_ID_REQUIRED", "orderId is required and must be valid");
    }
    if (!category || typeof category !== "string") {
      throw createError(400, "INVALID_CATEGORY", "category is required");
    }

    const parsedAttachmentIds = Array.isArray(attachmentIds)
      ? attachmentIds.map((id) => parseObjectIdOrNull(id))
      : [];
    if (parsedAttachmentIds.some((id) => !id)) {
      throw createError(400, "INVALID_ATTACHMENT_ID", "attachmentIds must contain valid ids");
    }

    const order = await ticketsRepository.findOrderById(parsedOrderId);
    try {
      assertCanAccessOrder(auth, order);
    } catch (error) {
      throw createError(404, "ORDER_NOT_FOUND", "Order not found");
    }

    if (!order) {
      throw createError(404, "ORDER_NOT_FOUND", "Order not found");
    }

    const mediaDocs = await ticketsRepository.findMediaByIds(parsedAttachmentIds);
    if (mediaDocs.length !== parsedAttachmentIds.length) {
      throw createError(400, "MEDIA_NOT_FOUND", "One or more attachments were not found");
    }
    const actorId = auth?.sub || auth?.userId || null;
    assertTicketAttachmentMedia({ actorId, mediaDocs });

    const settings = await ticketsRepository.findSettings();
    const timeZone = settings?.organizationTimezone || "America/Los_Angeles";
    const businessHours = settings?.businessHours || {
      monday: { start: "09:00", end: "17:00" },
      tuesday: { start: "09:00", end: "17:00" },
      wednesday: { start: "09:00", end: "17:00" },
      thursday: { start: "09:00", end: "17:00" },
      friday: { start: "09:00", end: "17:00" },
    };

    const testNowEnabled = process.env.TEST_NOW_ENABLED === "true";
    const now =
      testNowEnabled && headers["x-test-now"] ? new Date(String(headers["x-test-now"])) : new Date();
    if (Number.isNaN(now.getTime())) {
      throw createError(400, "INVALID_TEST_NOW", "x-test-now must be a valid ISO date");
    }

    const { firstResponseDueAt, resolutionDueAt } = computeSlaDeadlines({
      createdAt: now,
      timeZone,
      businessHours,
      firstResponseMinutes: SLA_FIRST_RESPONSE_MINUTES,
      resolutionMinutes: SLA_RESOLUTION_MINUTES,
    });

    const normalizedCategory = category.trim().toLowerCase();
    if (!normalizedCategory) {
      throw createError(400, "INVALID_CATEGORY", "category is required");
    }
    const routing = resolveCategoryRouting(normalizedCategory);

    const result = await ticketsRepository.insertTicket({
      orderId: parsedOrderId,
      customerId: order.customerId,
      category: normalizedCategory,
      routing,
      description: typeof description === "string" ? description.trim() : "",
      status: "open",
      legalHold: false,
      cleanedAt: null,
      sla: {
        firstResponseDueAt,
        resolutionDueAt,
        pausedAt: null,
        isPaused: false,
      },
      immutableOutcome: null,
      attachmentIds: parsedAttachmentIds,
      createdAt: now,
      updatedAt: now,
    });

    return {
      id: result.insertedId.toString(),
      orderId: parsedOrderId.toString(),
      status: "open",
      routing,
      sla: {
        firstResponseDueAt,
        resolutionDueAt,
      },
      holidaysIgnoredInMvp: true,
    };
  }

  async function getTicketById({ auth, ticketId }) {
    const ticket = await ticketsRepository.findTicketById(ticketId);
    try {
      assertCanAccessTicket(auth, ticket);
    } catch (error) {
      throw createError(404, "TICKET_NOT_FOUND", "Ticket not found");
    }

    if (!ticket) {
      throw createError(404, "TICKET_NOT_FOUND", "Ticket not found");
    }

    return {
      ticket: {
        id: ticket._id.toString(),
        orderId: ticket.orderId.toString(),
        category: ticket.category,
        routing: ticket.routing || null,
        status: ticket.status,
        legalHold: ticket.legalHold,
        description: ticket.description,
        attachmentIds: (ticket.attachmentIds || []).map((id) => id.toString()),
        sla: ticket.sla,
        immutableOutcome: ticket.immutableOutcome,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
      },
    };
  }

  async function listTickets({ auth, ObjectId }) {
    const tickets = isTicketStaff(auth)
      ? await ticketsRepository.findAllTickets()
      : await ticketsRepository.findTicketsByCustomerId(new ObjectId(auth.sub));

    return tickets.map((ticket) => ({
      id: ticket._id.toString(),
      orderId: ticket.orderId.toString(),
      customerId: ticket.customerId?.toString?.() || null,
      category: ticket.category,
      routing: ticket.routing || null,
      status: ticket.status,
      legalHold: ticket.legalHold,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      sla: ticket.sla,
      immutableOutcome: ticket.immutableOutcome,
    }));
  }

  async function updateTicketStatus({ auth, ticketId, status, req }) {
    const ticket = await ticketsRepository.findTicketById(ticketId);
    try {
      assertCanAccessTicket(auth, ticket);
    } catch (error) {
      throw createError(404, "TICKET_NOT_FOUND", "Ticket not found");
    }

    if (!ticket) {
      throw createError(404, "TICKET_NOT_FOUND", "Ticket not found");
    }

    if (ticket.immutableOutcome) {
      throw createError(409, "IMMUTABLE_OUTCOME", "Resolved ticket outcome is immutable");
    }

    const normalizedStatus = normalizeStatus(status);
    if (!normalizedStatus || !["open", "waiting_on_customer"].includes(normalizedStatus)) {
      throw createError(400, "INVALID_STATUS", "status must be one of open or waiting_on_customer");
    }

    const currentStatus = normalizeStatus(ticket.status);
    const transitionPolicy = isTicketStaff(auth) ? STAFF_STATUS_TRANSITIONS : CUSTOMER_STATUS_TRANSITIONS;
    const allowedTargets = transitionPolicy[currentStatus] || [];
    if (!allowedTargets.includes(normalizedStatus)) {
      if (isTicketStaff(auth)) {
        throw createError(409, "INVALID_STATUS_TRANSITION", "status transition is not allowed");
      }
      throw createError(403, "FORBIDDEN_STATUS_TRANSITION", "status transition is not allowed for this role");
    }

    const now = new Date();
    const updates = { status: normalizedStatus, updatedAt: now };
    if (normalizedStatus === "waiting_on_customer" && !ticket.sla?.isPaused) {
      updates["sla.isPaused"] = true;
      updates["sla.pausedAt"] = now;
    }
    if (normalizedStatus !== "waiting_on_customer" && ticket.sla?.isPaused && ticket.sla?.pausedAt) {
      const pausedAt = new Date(ticket.sla.pausedAt);
      const pauseDurationMs = now.getTime() - pausedAt.getTime();
      const currentResolutionDueAt = new Date(ticket.sla.resolutionDueAt);
      updates["sla.resolutionDueAt"] = new Date(currentResolutionDueAt.getTime() + pauseDurationMs);
      updates["sla.isPaused"] = false;
      updates["sla.pausedAt"] = null;
    }

    await ticketsRepository.updateTicketById(ticketId, updates);
    await writeAuditLog({
      username: auth?.username,
      userId: auth?.sub ? new ObjectId(auth.sub) : null,
      action: "ticket.status.update",
      outcome: "success",
      req,
      details: {
        ticketId: ticketId.toString(),
        fromStatus: currentStatus,
        toStatus: normalizedStatus,
      },
    });

    return { status: normalizedStatus };
  }

  async function setTicketLegalHold({ auth, ticketId, legalHold, req }) {
    const updated = await ticketsRepository.updateTicketLegalHold(ticketId, legalHold);
    if (updated.matchedCount === 0) {
      throw createError(404, "TICKET_NOT_FOUND", "Ticket not found");
    }

    await writeAuditLog({
      username: auth?.username,
      userId: auth?.sub ? new ObjectId(auth.sub) : null,
      action: "ticket.legal_hold.update",
      outcome: "success",
      req,
      details: {
        ticketId: ticketId.toString(),
        legalHold,
      },
    });

    return { legalHold };
  }

  async function resolveTicket({
    auth,
    ticketId,
    summaryText,
    attachmentIds,
    parseObjectIdOrNull,
    ObjectId,
    req,
    writeAuditLog,
  }) {
    const parsedAttachmentIds = Array.isArray(attachmentIds)
      ? attachmentIds.map((id) => parseObjectIdOrNull(id))
      : [];
    if (parsedAttachmentIds.some((id) => !id)) {
      throw createError(400, "INVALID_ATTACHMENT_ID", "attachmentIds must contain valid ids");
    }

    const ticket = await ticketsRepository.findTicketById(ticketId);
    if (!ticket) {
      throw createError(404, "TICKET_NOT_FOUND", "Ticket not found");
    }
    if (ticket.immutableOutcome) {
      throw createError(409, "IMMUTABLE_OUTCOME", "Resolved ticket outcome is immutable");
    }

    const mediaDocs = await ticketsRepository.findMediaByIds(parsedAttachmentIds);
    if (mediaDocs.length !== parsedAttachmentIds.length) {
      throw createError(400, "MEDIA_NOT_FOUND", "One or more attachments were not found");
    }

    const actorId = auth?.sub || auth?.userId || null;
    assertTicketAttachmentMedia({
      actorId,
      allowTicketExisting: true,
      currentAttachmentIds: ticket.attachmentIds || [],
      mediaDocs,
    });

    const outcome = {
      resolvedAt: new Date(),
      summaryText: summaryText.trim(),
      attachmentIds: parsedAttachmentIds,
      resolvedByUserId: new ObjectId(auth.sub),
    };

    const updated = await ticketsRepository.resolveTicket(ticketId, outcome);
    if (updated.modifiedCount === 0) {
      throw createError(409, "IMMUTABLE_OUTCOME", "Resolved ticket outcome is immutable");
    }

    await writeAuditLog({
      username: auth?.username,
      userId: auth?.sub ? new ObjectId(auth.sub) : null,
      action: "ticket.outcome.resolved",
      outcome: "success",
      req,
      details: {
        ticketId: ticketId.toString(),
        attachmentCount: parsedAttachmentIds.length,
      },
    });

    return {
      status: "resolved",
      immutableOutcome: {
        ...outcome,
        attachmentIds: outcome.attachmentIds.map((id) => id.toString()),
        resolvedByUserId: outcome.resolvedByUserId.toString(),
      },
    };
  }

  return {
    createTicket,
    getTicketById,
    listTickets,
    resolveTicket,
    setTicketLegalHold,
    updateTicketStatus,
  };
}

module.exports = {
  createTicketsService,
};
