const test = require("node:test");
const assert = require("node:assert/strict");

const { createTicketsService } = require("./ticketsService");

function createError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

test("updateTicketStatus pauses SLA when waiting on customer", async () => {
  let updates = null;
  const service = createTicketsService({
    assertCanAccessOrder: () => {},
    assertCanAccessTicket: () => {},
    computeSlaDeadlines: () => ({}),
    createError,
    ticketsRepository: {
      findTicketById: async () => ({ _id: 't1', sla: { isPaused: false }, immutableOutcome: null }),
      updateTicketById: async (ticketId, nextUpdates) => {
        updates = { ticketId, nextUpdates };
      },
    },
    SLA_FIRST_RESPONSE_MINUTES: 480,
    SLA_RESOLUTION_MINUTES: 2400,
  });

  const result = await service.updateTicketStatus({ auth: { sub: 'u1' }, ticketId: 't1', status: 'waiting_on_customer' });
  assert.deepEqual(result, { status: 'waiting_on_customer' });
  assert.equal(updates.ticketId, 't1');
  assert.equal(updates.nextUpdates['sla.isPaused'], true);
  assert.ok(updates.nextUpdates['sla.pausedAt'] instanceof Date);
});

test("updateTicketStatus resumes SLA and extends resolution due date", async () => {
  let updates = null;
  const pausedAt = new Date(Date.now() - 5 * 60 * 1000);
  const resolutionDueAt = new Date(Date.now() + 60 * 60 * 1000);
  const service = createTicketsService({
    assertCanAccessOrder: () => {},
    assertCanAccessTicket: () => {},
    computeSlaDeadlines: () => ({}),
    createError,
    ticketsRepository: {
      findTicketById: async () => ({
        _id: 't1',
        sla: { isPaused: true, pausedAt, resolutionDueAt },
        immutableOutcome: null,
      }),
      updateTicketById: async (ticketId, nextUpdates) => {
        updates = { ticketId, nextUpdates };
      },
    },
    SLA_FIRST_RESPONSE_MINUTES: 480,
    SLA_RESOLUTION_MINUTES: 2400,
  });

  const result = await service.updateTicketStatus({ auth: { sub: 'u1' }, ticketId: 't1', status: 'open' });
  assert.deepEqual(result, { status: 'open' });
  assert.equal(updates.nextUpdates['sla.isPaused'], false);
  assert.equal(updates.nextUpdates['sla.pausedAt'], null);
  assert.ok(updates.nextUpdates['sla.resolutionDueAt'] > resolutionDueAt);
});

test("setTicketLegalHold throws when ticket is missing", async () => {
  const service = createTicketsService({
    assertCanAccessOrder: () => {},
    assertCanAccessTicket: () => {},
    computeSlaDeadlines: () => ({}),
    createError,
    ticketsRepository: {
      updateTicketLegalHold: async () => ({ matchedCount: 0 }),
    },
    SLA_FIRST_RESPONSE_MINUTES: 480,
    SLA_RESOLUTION_MINUTES: 2400,
  });

  await assert.rejects(
    () => service.setTicketLegalHold({ ticketId: 't1', legalHold: true }),
    (error) => error && error.code === 'TICKET_NOT_FOUND',
  );
});

test("createTicket applies category routing and SLA targets", async () => {
  let inserted = null;
  const now = new Date("2026-03-30T16:00:00.000Z");
  const service = createTicketsService({
    assertCanAccessOrder: () => {},
    assertCanAccessTicket: () => {},
    computeSlaDeadlines: ({ firstResponseMinutes, resolutionMinutes }) => {
      assert.equal(firstResponseMinutes, 480);
      assert.equal(resolutionMinutes, 2400);
      return {
        firstResponseDueAt: new Date(now.getTime() + firstResponseMinutes * 60 * 1000),
        resolutionDueAt: new Date(now.getTime() + resolutionMinutes * 60 * 1000),
      };
    },
    createError,
    ticketsRepository: {
      findOrderById: async () => ({ customerId: { toString: () => "u1" } }),
      findMediaByIds: async () => [],
      findSettings: async () => ({
        organizationTimezone: "America/Los_Angeles",
        businessHours: {
          monday: { start: "09:00", end: "17:00" },
          tuesday: { start: "09:00", end: "17:00" },
          wednesday: { start: "09:00", end: "17:00" },
          thursday: { start: "09:00", end: "17:00" },
          friday: { start: "09:00", end: "17:00" },
        },
      }),
      insertTicket: async (doc) => {
        inserted = doc;
        return { insertedId: { toString: () => "t1" } };
      },
    },
    SLA_FIRST_RESPONSE_MINUTES: 480,
    SLA_RESOLUTION_MINUTES: 2400,
  });

  const result = await service.createTicket({
    auth: { sub: "u1", roles: ["customer"] },
    headers: { "x-test-now": now.toISOString() },
    payload: {
      orderId: "ord1",
      category: "Billing",
      description: "invoice mismatch",
      attachmentIds: [],
      parseObjectIdOrNull: (value) => ({ toString: () => String(value) }),
    },
  });

  assert.equal(inserted.category, "billing");
  assert.deepEqual(inserted.routing, { team: "billing_ops", queue: "billing_queue" });
  assert.deepEqual(result.routing, { team: "billing_ops", queue: "billing_queue" });
});
