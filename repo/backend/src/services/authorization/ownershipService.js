function createNotFoundError() {
  const error = new Error("Resource not found");
  error.status = 404;
  error.code = "NOT_FOUND";
  return error;
}

function actorId(actor) {
  return actor?.userId || actor?.sub || null;
}

function hasRole(actor, role) {
  return Array.isArray(actor?.roles) && actor.roles.includes(role);
}

function isOrderStaff(actor) {
  return hasRole(actor, "administrator") || hasRole(actor, "service_manager");
}

function isTicketStaff(actor) {
  return hasRole(actor, "administrator") || hasRole(actor, "service_manager") || hasRole(actor, "moderator");
}

function assertCanAccessOrder(actor, order) {
  if (!order) {
    throw createNotFoundError();
  }

  if (isOrderStaff(actor)) {
    return;
  }

  if (order.customerId && order.customerId.toString() === actorId(actor)) {
    return;
  }

  throw createNotFoundError();
}

function assertCanAccessTicket(actor, ticket) {
  if (!ticket) {
    throw createNotFoundError();
  }

  if (isTicketStaff(actor)) {
    return;
  }

  if (ticket.customerId && ticket.customerId.toString() === actorId(actor)) {
    return;
  }

  throw createNotFoundError();
}

function assertCanSubmitReviewForOrder(actor, order) {
  if (!order) {
    throw createNotFoundError();
  }

  if (order.customerId && order.customerId.toString() === actorId(actor)) {
    return;
  }

  throw createNotFoundError();
}

module.exports = {
  assertCanAccessOrder,
  assertCanAccessTicket,
  assertCanSubmitReviewForOrder,
};
