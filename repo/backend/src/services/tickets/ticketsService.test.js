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
    ObjectId: function ObjectId(value) { this.value = value; this.toString = () => String(value); },
    ticketsRepository: {
      findTicketById: async () => ({ _id: 't1', status: 'open', sla: { isPaused: false }, immutableOutcome: null }),
      updateTicketById: async (ticketId, nextUpdates) => {
        updates = { ticketId, nextUpdates };
      },
    },
    SLA_FIRST_RESPONSE_MINUTES: 480,
    SLA_RESOLUTION_MINUTES: 2400,
    writeAuditLog: async () => {},
  });

  const result = await service.updateTicketStatus({
    auth: { sub: 'u1', roles: ['administrator'] },
    ticketId: 't1',
    status: 'waiting_on_customer',
  });
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
    ObjectId: function ObjectId(value) { this.value = value; this.toString = () => String(value); },
    ticketsRepository: {
      findTicketById: async () => ({
        _id: 't1',
        status: 'waiting_on_customer',
        sla: { isPaused: true, pausedAt, resolutionDueAt },
        immutableOutcome: null,
      }),
      updateTicketById: async (ticketId, nextUpdates) => {
        updates = { ticketId, nextUpdates };
      },
    },
    SLA_FIRST_RESPONSE_MINUTES: 480,
    SLA_RESOLUTION_MINUTES: 2400,
    writeAuditLog: async () => {},
  });

  const result = await service.updateTicketStatus({
    auth: { sub: 'u1', roles: ['administrator'] },
    ticketId: 't1',
    status: 'open',
  });
  assert.deepEqual(result, { status: 'open' });
  assert.equal(updates.nextUpdates['sla.isPaused'], false);
  assert.equal(updates.nextUpdates['sla.pausedAt'], null);
  assert.ok(updates.nextUpdates['sla.resolutionDueAt'] > resolutionDueAt);
});

test("updateTicketStatus rejects unsupported status values", async () => {
  const service = createTicketsService({
    assertCanAccessOrder: () => {},
    assertCanAccessTicket: () => {},
    computeSlaDeadlines: () => ({}),
    createError,
    ObjectId: function ObjectId(value) { this.value = value; this.toString = () => String(value); },
    ticketsRepository: {
      findTicketById: async () => ({ _id: 't1', status: 'open', sla: { isPaused: false }, immutableOutcome: null }),
      updateTicketById: async () => {
        throw new Error('should not update');
      },
    },
    SLA_FIRST_RESPONSE_MINUTES: 480,
    SLA_RESOLUTION_MINUTES: 2400,
    writeAuditLog: async () => {},
  });

  await assert.rejects(
    () => service.updateTicketStatus({ auth: { sub: 'u1', roles: ['customer'] }, ticketId: 't1', status: 'closed' }),
    (error) => error && error.code === 'INVALID_STATUS' && error.status === 400,
  );
});

test("updateTicketStatus blocks customer-only forbidden transitions", async () => {
  const service = createTicketsService({
    assertCanAccessOrder: () => {},
    assertCanAccessTicket: () => {},
    computeSlaDeadlines: () => ({}),
    createError,
    ObjectId: function ObjectId(value) { this.value = value; this.toString = () => String(value); },
    ticketsRepository: {
      findTicketById: async () => ({ _id: 't1', status: 'open', sla: { isPaused: false }, immutableOutcome: null }),
      updateTicketById: async () => {
        throw new Error('should not update');
      },
    },
    SLA_FIRST_RESPONSE_MINUTES: 480,
    SLA_RESOLUTION_MINUTES: 2400,
    writeAuditLog: async () => {},
  });

  await assert.rejects(
    () =>
      service.updateTicketStatus({
        auth: { sub: 'u1', roles: ['customer'] },
        ticketId: 't1',
        status: 'waiting_on_customer',
      }),
    (error) => error && error.code === 'FORBIDDEN_STATUS_TRANSITION' && error.status === 403,
  );
});

test("setTicketLegalHold throws when ticket is missing", async () => {
  const service = createTicketsService({
    assertCanAccessOrder: () => {},
    assertCanAccessTicket: () => {},
    computeSlaDeadlines: () => ({}),
    createError,
    ObjectId: function ObjectId(value) { this.value = value; this.toString = () => String(value); },
    ticketsRepository: {
      updateTicketLegalHold: async () => ({ matchedCount: 0 }),
    },
    SLA_FIRST_RESPONSE_MINUTES: 480,
    SLA_RESOLUTION_MINUTES: 2400,
    writeAuditLog: async () => {},
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
    ObjectId: function ObjectId(value) { this.value = value; this.toString = () => String(value); },
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
    writeAuditLog: async () => {},
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

test("createTicket maps frontend ticket categories to explicit routing", async () => {
  let inserted = null;
  const service = createTicketsService({
    assertCanAccessOrder: () => {},
    assertCanAccessTicket: () => {},
    computeSlaDeadlines: () => ({
      firstResponseDueAt: new Date(),
      resolutionDueAt: new Date(),
    }),
    createError,
    ObjectId: function ObjectId(value) { this.value = value; this.toString = () => String(value); },
    ticketsRepository: {
      findOrderById: async () => ({ customerId: { toString: () => "u1" } }),
      findMediaByIds: async () => [],
      findSettings: async () => null,
      insertTicket: async (doc) => {
        inserted = doc;
        return { insertedId: { toString: () => "t2" } };
      },
    },
    SLA_FIRST_RESPONSE_MINUTES: 480,
    SLA_RESOLUTION_MINUTES: 2400,
    writeAuditLog: async () => {},
  });

  const result = await service.createTicket({
    auth: { sub: "u1", roles: ["customer"] },
    headers: {},
    payload: {
      orderId: "ord1",
      category: "service_quality",
      description: "quality follow-up",
      attachmentIds: [],
      parseObjectIdOrNull: (value) => ({ toString: () => String(value) }),
    },
  });

  assert.equal(inserted.category, "service_quality");
  assert.deepEqual(inserted.routing, { team: "service_ops", queue: "service_recovery_queue" });
  assert.deepEqual(result.routing, { team: "service_ops", queue: "service_recovery_queue" });
});

test("createTicket rejects attachments not owned by requester", async () => {
  const service = createTicketsService({
    assertCanAccessOrder: () => {},
    assertCanAccessTicket: () => {},
    computeSlaDeadlines: () => ({
      firstResponseDueAt: new Date(),
      resolutionDueAt: new Date(),
    }),
    createError,
    ObjectId: function ObjectId(value) { this.value = value; this.toString = () => String(value); },
    ticketsRepository: {
      findOrderById: async () => ({ customerId: { toString: () => "u1" } }),
      findMediaByIds: async () => [{ _id: "m1", purpose: "ticket", createdBy: { toString: () => "u2" } }],
      findSettings: async () => null,
      insertTicket: async () => {
        throw new Error("should not insert");
      },
    },
    SLA_FIRST_RESPONSE_MINUTES: 480,
    SLA_RESOLUTION_MINUTES: 2400,
    writeAuditLog: async () => {},
  });

  await assert.rejects(
    () =>
      service.createTicket({
        auth: { sub: "u1", roles: ["customer"] },
        headers: {},
        payload: {
          orderId: "ord1",
          category: "billing",
          description: "invoice mismatch",
          attachmentIds: ["m1"],
          parseObjectIdOrNull: (value) => ({ toString: () => String(value) }),
        },
      }),
    (error) => error && error.code === "MEDIA_FORBIDDEN" && error.status === 403,
  );
});

test("createTicket rejects non-ticket attachment purpose", async () => {
  const service = createTicketsService({
    assertCanAccessOrder: () => {},
    assertCanAccessTicket: () => {},
    computeSlaDeadlines: () => ({
      firstResponseDueAt: new Date(),
      resolutionDueAt: new Date(),
    }),
    createError,
    ObjectId: function ObjectId(value) { this.value = value; this.toString = () => String(value); },
    ticketsRepository: {
      findOrderById: async () => ({ customerId: { toString: () => "u1" } }),
      findMediaByIds: async () => [{ _id: "m1", purpose: "review", createdBy: { toString: () => "u1" } }],
      findSettings: async () => null,
      insertTicket: async () => {
        throw new Error("should not insert");
      },
    },
    SLA_FIRST_RESPONSE_MINUTES: 480,
    SLA_RESOLUTION_MINUTES: 2400,
    writeAuditLog: async () => {},
  });

  await assert.rejects(
    () =>
      service.createTicket({
        auth: { sub: "u1", roles: ["customer"] },
        headers: {},
        payload: {
          orderId: "ord1",
          category: "billing",
          description: "invoice mismatch",
          attachmentIds: ["m1"],
          parseObjectIdOrNull: (value) => ({ toString: () => String(value) }),
        },
      }),
    (error) => error && error.code === "INVALID_ATTACHMENT_PURPOSE" && error.status === 400,
  );
});

test("resolveTicket rejects foreign attachments not already on the ticket", async () => {
  const service = createTicketsService({
    assertCanAccessOrder: () => {},
    assertCanAccessTicket: () => {},
    computeSlaDeadlines: () => ({ firstResponseDueAt: new Date(), resolutionDueAt: new Date() }),
    createError,
    ObjectId: function ObjectId(value) { this.value = value; this.toString = () => String(value); },
    ticketsRepository: {
      findTicketById: async () => ({ _id: "t1", immutableOutcome: null, attachmentIds: [{ toString: () => "m-existing" }] }),
      findMediaByIds: async () => [{ _id: { toString: () => "m-foreign" }, purpose: "ticket", createdBy: { toString: () => "u2" } }],
      resolveTicket: async () => ({ modifiedCount: 1 }),
    },
    SLA_FIRST_RESPONSE_MINUTES: 480,
    SLA_RESOLUTION_MINUTES: 2400,
    writeAuditLog: async () => {},
  });

  await assert.rejects(
    () =>
      service.resolveTicket({
        auth: { sub: "u1", roles: ["moderator"] },
        ticketId: { toString: () => "t1" },
        summaryText: "resolved",
        attachmentIds: ["m-foreign"],
        parseObjectIdOrNull: (value) => ({ toString: () => String(value) }),
        ObjectId: function LocalObjectId(value) { this.value = value; this.toString = () => String(value); },
        req: { headers: {} },
        writeAuditLog: async () => {},
      }),
    (error) => error && error.code === "MEDIA_FORBIDDEN" && error.status === 403,
  );
});
