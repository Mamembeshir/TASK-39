const test = require("node:test");
const assert = require("node:assert/strict");

const { createTicketsService } = require("../../../../src/services/tickets/ticketsService");

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

test("updateTicketStatus rejects changes once outcome is immutable", async () => {
  const service = createTicketsService({
    assertCanAccessOrder: () => {},
    assertCanAccessTicket: () => {},
    computeSlaDeadlines: () => ({}),
    createError,
    ObjectId: function ObjectId(value) { this.value = value; this.toString = () => String(value); },
    ticketsRepository: {
      findTicketById: async () => ({
        _id: 't1',
        status: 'open',
        sla: { isPaused: false },
        immutableOutcome: { resolvedAt: new Date(), summaryText: 'done' },
      }),
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
        auth: { sub: 'u1', roles: ['administrator'] },
        ticketId: 't1',
        status: 'waiting_on_customer',
      }),
    (error) => error && error.code === 'IMMUTABLE_OUTCOME' && error.status === 409,
  );
});

test("updateTicketStatus allows staff to pause SLA via waiting_on_customer", async () => {
  let captured = null;
  const service = createTicketsService({
    assertCanAccessOrder: () => {},
    assertCanAccessTicket: () => {},
    computeSlaDeadlines: () => ({}),
    createError,
    ObjectId: function ObjectId(value) { this.value = value; this.toString = () => String(value); },
    ticketsRepository: {
      findTicketById: async () => ({
        _id: 't1',
        status: 'open',
        sla: { isPaused: false },
        immutableOutcome: null,
      }),
      updateTicketById: async (_id, updates) => {
        captured = updates;
      },
    },
    SLA_FIRST_RESPONSE_MINUTES: 480,
    SLA_RESOLUTION_MINUTES: 2400,
    writeAuditLog: async () => {},
  });

  const result = await service.updateTicketStatus({
    auth: { sub: 'u1', roles: ['service_manager'] },
    ticketId: 't1',
    status: 'waiting_on_customer',
  });

  assert.equal(result.status, 'waiting_on_customer');
  assert.equal(captured['sla.isPaused'], true);
  assert.ok(captured['sla.pausedAt'] instanceof Date);
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

// ─── additional coverage tests ───────────────────────────────────────────────

function makeObjectIdStub() {
  return function ObjectId(value) {
    this.value = value;
    this.toString = () => String(value);
  };
}

test("createTicket rejects missing orderId", async () => {
  const service = createTicketsService({
    assertCanAccessOrder: () => {},
    assertCanAccessTicket: () => {},
    computeSlaDeadlines: () => ({}),
    createError,
    ObjectId: makeObjectIdStub(),
    ticketsRepository: {},
    SLA_FIRST_RESPONSE_MINUTES: 480,
    SLA_RESOLUTION_MINUTES: 2400,
    writeAuditLog: async () => {},
  });

  await assert.rejects(
    () =>
      service.createTicket({
        auth: { sub: "u1" },
        headers: {},
        payload: { orderId: "bad", category: "billing", parseObjectIdOrNull: () => null },
      }),
    (err) => err.code === "ORDER_ID_REQUIRED",
  );
});

test("createTicket rejects missing category", async () => {
  const service = createTicketsService({
    assertCanAccessOrder: () => {},
    assertCanAccessTicket: () => {},
    computeSlaDeadlines: () => ({}),
    createError,
    ObjectId: makeObjectIdStub(),
    ticketsRepository: {},
    SLA_FIRST_RESPONSE_MINUTES: 480,
    SLA_RESOLUTION_MINUTES: 2400,
    writeAuditLog: async () => {},
  });
  await assert.rejects(
    () =>
      service.createTicket({
        auth: { sub: "u1" },
        headers: {},
        payload: { orderId: "o1", category: null, parseObjectIdOrNull: (v) => ({ toString: () => v }) },
      }),
    (err) => err.code === "INVALID_CATEGORY",
  );
});

test("createTicket rejects invalid attachment ids", async () => {
  const service = createTicketsService({
    assertCanAccessOrder: () => {},
    assertCanAccessTicket: () => {},
    computeSlaDeadlines: () => ({}),
    createError,
    ObjectId: makeObjectIdStub(),
    ticketsRepository: {},
    SLA_FIRST_RESPONSE_MINUTES: 480,
    SLA_RESOLUTION_MINUTES: 2400,
    writeAuditLog: async () => {},
  });
  await assert.rejects(
    () =>
      service.createTicket({
        auth: { sub: "u1" },
        headers: {},
        payload: {
          orderId: "o1",
          category: "billing",
          attachmentIds: ["bad"],
          parseObjectIdOrNull: (v) => (v === "o1" ? { toString: () => v } : null),
        },
      }),
    (err) => err.code === "INVALID_ATTACHMENT_ID",
  );
});

test("createTicket maps access errors to 404 not found", async () => {
  const service = createTicketsService({
    assertCanAccessOrder: () => { throw new Error("forbidden"); },
    assertCanAccessTicket: () => {},
    computeSlaDeadlines: () => ({}),
    createError,
    ObjectId: makeObjectIdStub(),
    ticketsRepository: {
      findOrderById: async () => ({ customerId: { toString: () => "u2" } }),
    },
    SLA_FIRST_RESPONSE_MINUTES: 480,
    SLA_RESOLUTION_MINUTES: 2400,
    writeAuditLog: async () => {},
  });
  await assert.rejects(
    () =>
      service.createTicket({
        auth: { sub: "u1" },
        headers: {},
        payload: {
          orderId: "o1",
          category: "billing",
          attachmentIds: [],
          parseObjectIdOrNull: (v) => ({ toString: () => v }),
        },
      }),
    (err) => err.code === "ORDER_NOT_FOUND",
  );
});

test("createTicket rejects when order not found", async () => {
  const service = createTicketsService({
    assertCanAccessOrder: () => {},
    assertCanAccessTicket: () => {},
    computeSlaDeadlines: () => ({}),
    createError,
    ObjectId: makeObjectIdStub(),
    ticketsRepository: {
      findOrderById: async () => null,
    },
    SLA_FIRST_RESPONSE_MINUTES: 480,
    SLA_RESOLUTION_MINUTES: 2400,
    writeAuditLog: async () => {},
  });
  await assert.rejects(
    () =>
      service.createTicket({
        auth: { sub: "u1" },
        headers: {},
        payload: {
          orderId: "o1",
          category: "billing",
          attachmentIds: [],
          parseObjectIdOrNull: (v) => ({ toString: () => v }),
        },
      }),
    (err) => err.code === "ORDER_NOT_FOUND",
  );
});

test("createTicket rejects when media not found", async () => {
  const service = createTicketsService({
    assertCanAccessOrder: () => {},
    assertCanAccessTicket: () => {},
    computeSlaDeadlines: () => ({}),
    createError,
    ObjectId: makeObjectIdStub(),
    ticketsRepository: {
      findOrderById: async () => ({ customerId: { toString: () => "u1" } }),
      findMediaByIds: async () => [],
    },
    SLA_FIRST_RESPONSE_MINUTES: 480,
    SLA_RESOLUTION_MINUTES: 2400,
    writeAuditLog: async () => {},
  });
  await assert.rejects(
    () =>
      service.createTicket({
        auth: { sub: "u1" },
        headers: {},
        payload: {
          orderId: "o1",
          category: "billing",
          attachmentIds: ["m1"],
          parseObjectIdOrNull: (v) => ({ toString: () => v }),
        },
      }),
    (err) => err.code === "MEDIA_NOT_FOUND",
  );
});

test("createTicket rejects invalid test-now header", async () => {
  const prev = process.env.TEST_NOW_ENABLED;
  process.env.TEST_NOW_ENABLED = "true";
  const service = createTicketsService({
    assertCanAccessOrder: () => {},
    assertCanAccessTicket: () => {},
    computeSlaDeadlines: () => ({}),
    createError,
    ObjectId: makeObjectIdStub(),
    ticketsRepository: {
      findOrderById: async () => ({ customerId: { toString: () => "u1" } }),
      findMediaByIds: async () => [],
      findSettings: async () => null,
    },
    SLA_FIRST_RESPONSE_MINUTES: 480,
    SLA_RESOLUTION_MINUTES: 2400,
    writeAuditLog: async () => {},
  });
  try {
    await assert.rejects(
      () =>
        service.createTicket({
          auth: { sub: "u1" },
          headers: { "x-test-now": "not-a-date" },
          payload: {
            orderId: "o1",
            category: "billing",
            attachmentIds: [],
            parseObjectIdOrNull: (v) => ({ toString: () => v }),
          },
        }),
      (err) => err.code === "INVALID_TEST_NOW",
    );
  } finally {
    if (prev === undefined) delete process.env.TEST_NOW_ENABLED;
    else process.env.TEST_NOW_ENABLED = prev;
  }
});

test("getTicketById returns full serialized ticket", async () => {
  const service = createTicketsService({
    assertCanAccessOrder: () => {},
    assertCanAccessTicket: () => {},
    computeSlaDeadlines: () => ({}),
    createError,
    ObjectId: makeObjectIdStub(),
    ticketsRepository: {
      findTicketById: async () => ({
        _id: { toString: () => "t1" },
        orderId: { toString: () => "o1" },
        category: "billing",
        routing: { team: "billing_ops", queue: "billing_queue" },
        status: "open",
        legalHold: false,
        description: "hi",
        attachmentIds: [{ toString: () => "m1" }],
        sla: {},
        immutableOutcome: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    },
    SLA_FIRST_RESPONSE_MINUTES: 480,
    SLA_RESOLUTION_MINUTES: 2400,
    writeAuditLog: async () => {},
  });
  const result = await service.getTicketById({ auth: { sub: "u1" }, ticketId: "t1" });
  assert.equal(result.ticket.id, "t1");
  assert.deepEqual(result.ticket.attachmentIds, ["m1"]);
});

test("getTicketById throws not-found on access error", async () => {
  const service = createTicketsService({
    assertCanAccessOrder: () => {},
    assertCanAccessTicket: () => { throw new Error("nope"); },
    computeSlaDeadlines: () => ({}),
    createError,
    ObjectId: makeObjectIdStub(),
    ticketsRepository: { findTicketById: async () => ({ _id: "t", orderId: "o" }) },
    SLA_FIRST_RESPONSE_MINUTES: 480,
    SLA_RESOLUTION_MINUTES: 2400,
    writeAuditLog: async () => {},
  });
  await assert.rejects(
    () => service.getTicketById({ auth: {}, ticketId: "t" }),
    (err) => err.code === "TICKET_NOT_FOUND",
  );
});

test("getTicketById throws when ticket is null", async () => {
  const service = createTicketsService({
    assertCanAccessOrder: () => {},
    assertCanAccessTicket: () => {},
    computeSlaDeadlines: () => ({}),
    createError,
    ObjectId: makeObjectIdStub(),
    ticketsRepository: { findTicketById: async () => null },
    SLA_FIRST_RESPONSE_MINUTES: 480,
    SLA_RESOLUTION_MINUTES: 2400,
    writeAuditLog: async () => {},
  });
  await assert.rejects(
    () => service.getTicketById({ auth: {}, ticketId: "t" }),
    (err) => err.code === "TICKET_NOT_FOUND",
  );
});

test("listTickets uses customer lookup for non-staff", async () => {
  let customerLookupCalled = false;
  const service = createTicketsService({
    assertCanAccessOrder: () => {},
    assertCanAccessTicket: () => {},
    computeSlaDeadlines: () => ({}),
    createError,
    ObjectId: makeObjectIdStub(),
    ticketsRepository: {
      findAllTickets: async () => { throw new Error("should not"); },
      findTicketsByCustomerId: async () => {
        customerLookupCalled = true;
        return [
          {
            _id: { toString: () => "t1" },
            orderId: { toString: () => "o1" },
            customerId: { toString: () => "u1" },
            category: "billing",
            status: "open",
            legalHold: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            sla: {},
            immutableOutcome: null,
          },
        ];
      },
    },
    SLA_FIRST_RESPONSE_MINUTES: 480,
    SLA_RESOLUTION_MINUTES: 2400,
    writeAuditLog: async () => {},
  });
  const tickets = await service.listTickets({
    auth: { sub: "u1", roles: ["customer"] },
    ObjectId: makeObjectIdStub(),
  });
  assert.equal(customerLookupCalled, true);
  assert.equal(tickets.length, 1);
  assert.equal(tickets[0].customerId, "u1");
});

test("listTickets uses findAllTickets for staff", async () => {
  const service = createTicketsService({
    assertCanAccessOrder: () => {},
    assertCanAccessTicket: () => {},
    computeSlaDeadlines: () => ({}),
    createError,
    ObjectId: makeObjectIdStub(),
    ticketsRepository: {
      findAllTickets: async () => [],
      findTicketsByCustomerId: async () => { throw new Error("no"); },
    },
    SLA_FIRST_RESPONSE_MINUTES: 480,
    SLA_RESOLUTION_MINUTES: 2400,
    writeAuditLog: async () => {},
  });
  const tickets = await service.listTickets({
    auth: { sub: "u1", roles: ["administrator"] },
    ObjectId: makeObjectIdStub(),
  });
  assert.deepEqual(tickets, []);
});

test("setTicketLegalHold succeeds and writes audit log", async () => {
  let auditLogged = false;
  const service = createTicketsService({
    assertCanAccessOrder: () => {},
    assertCanAccessTicket: () => {},
    computeSlaDeadlines: () => ({}),
    createError,
    ObjectId: makeObjectIdStub(),
    ticketsRepository: {
      updateTicketLegalHold: async () => ({ matchedCount: 1 }),
    },
    SLA_FIRST_RESPONSE_MINUTES: 480,
    SLA_RESOLUTION_MINUTES: 2400,
    writeAuditLog: async () => { auditLogged = true; },
  });
  const result = await service.setTicketLegalHold({
    auth: { sub: "507f1f77bcf86cd799439011", username: "admin" },
    ticketId: { toString: () => "t1" },
    legalHold: true,
    req: {},
  });
  assert.deepEqual(result, { legalHold: true });
  assert.equal(auditLogged, true);
});

test("resolveTicket rejects invalid attachment ids", async () => {
  const service = createTicketsService({
    assertCanAccessOrder: () => {},
    assertCanAccessTicket: () => {},
    computeSlaDeadlines: () => ({}),
    createError,
    ObjectId: makeObjectIdStub(),
    ticketsRepository: {},
    SLA_FIRST_RESPONSE_MINUTES: 480,
    SLA_RESOLUTION_MINUTES: 2400,
    writeAuditLog: async () => {},
  });
  await assert.rejects(
    () =>
      service.resolveTicket({
        auth: { sub: "u1" },
        ticketId: { toString: () => "t1" },
        summaryText: "done",
        attachmentIds: ["bad"],
        parseObjectIdOrNull: () => null,
        ObjectId: makeObjectIdStub(),
        req: {},
        writeAuditLog: async () => {},
      }),
    (err) => err.code === "INVALID_ATTACHMENT_ID",
  );
});

test("resolveTicket rejects when ticket is missing", async () => {
  const service = createTicketsService({
    assertCanAccessOrder: () => {},
    assertCanAccessTicket: () => {},
    computeSlaDeadlines: () => ({}),
    createError,
    ObjectId: makeObjectIdStub(),
    ticketsRepository: { findTicketById: async () => null },
    SLA_FIRST_RESPONSE_MINUTES: 480,
    SLA_RESOLUTION_MINUTES: 2400,
    writeAuditLog: async () => {},
  });
  await assert.rejects(
    () =>
      service.resolveTicket({
        auth: { sub: "u1" },
        ticketId: { toString: () => "t1" },
        summaryText: "done",
        attachmentIds: [],
        parseObjectIdOrNull: (v) => ({ toString: () => v }),
        ObjectId: makeObjectIdStub(),
        req: {},
        writeAuditLog: async () => {},
      }),
    (err) => err.code === "TICKET_NOT_FOUND",
  );
});

test("resolveTicket rejects when already immutable", async () => {
  const service = createTicketsService({
    assertCanAccessOrder: () => {},
    assertCanAccessTicket: () => {},
    computeSlaDeadlines: () => ({}),
    createError,
    ObjectId: makeObjectIdStub(),
    ticketsRepository: {
      findTicketById: async () => ({ _id: "t1", immutableOutcome: { resolvedAt: new Date() }, attachmentIds: [] }),
    },
    SLA_FIRST_RESPONSE_MINUTES: 480,
    SLA_RESOLUTION_MINUTES: 2400,
    writeAuditLog: async () => {},
  });
  await assert.rejects(
    () =>
      service.resolveTicket({
        auth: { sub: "u1" },
        ticketId: { toString: () => "t1" },
        summaryText: "done",
        attachmentIds: [],
        parseObjectIdOrNull: (v) => ({ toString: () => v }),
        ObjectId: makeObjectIdStub(),
        req: {},
        writeAuditLog: async () => {},
      }),
    (err) => err.code === "IMMUTABLE_OUTCOME",
  );
});

test("resolveTicket succeeds and returns immutable outcome", async () => {
  const service = createTicketsService({
    assertCanAccessOrder: () => {},
    assertCanAccessTicket: () => {},
    computeSlaDeadlines: () => ({}),
    createError,
    ObjectId: makeObjectIdStub(),
    ticketsRepository: {
      findTicketById: async () => ({ _id: "t1", immutableOutcome: null, attachmentIds: [] }),
      findMediaByIds: async () => [],
      resolveTicket: async () => ({ modifiedCount: 1 }),
    },
    SLA_FIRST_RESPONSE_MINUTES: 480,
    SLA_RESOLUTION_MINUTES: 2400,
    writeAuditLog: async () => {},
  });
  const result = await service.resolveTicket({
    auth: { sub: "507f1f77bcf86cd799439011", roles: ["administrator"] },
    ticketId: { toString: () => "t1" },
    summaryText: "all fixed",
    attachmentIds: [],
    parseObjectIdOrNull: (v) => ({ toString: () => v }),
    ObjectId: makeObjectIdStub(),
    req: {},
    writeAuditLog: async () => {},
  });
  assert.equal(result.status, "resolved");
  assert.equal(result.immutableOutcome.summaryText, "all fixed");
});

test("resolveTicket rejects when resolution no longer modifies (race)", async () => {
  const service = createTicketsService({
    assertCanAccessOrder: () => {},
    assertCanAccessTicket: () => {},
    computeSlaDeadlines: () => ({}),
    createError,
    ObjectId: makeObjectIdStub(),
    ticketsRepository: {
      findTicketById: async () => ({ _id: "t1", immutableOutcome: null, attachmentIds: [] }),
      findMediaByIds: async () => [],
      resolveTicket: async () => ({ modifiedCount: 0 }),
    },
    SLA_FIRST_RESPONSE_MINUTES: 480,
    SLA_RESOLUTION_MINUTES: 2400,
    writeAuditLog: async () => {},
  });
  await assert.rejects(
    () =>
      service.resolveTicket({
        auth: { sub: "507f1f77bcf86cd799439011" },
        ticketId: { toString: () => "t1" },
        summaryText: "done",
        attachmentIds: [],
        parseObjectIdOrNull: (v) => ({ toString: () => v }),
        ObjectId: makeObjectIdStub(),
        req: {},
        writeAuditLog: async () => {},
      }),
    (err) => err.code === "IMMUTABLE_OUTCOME",
  );
});

test("resolveTicket rejects media not found", async () => {
  const service = createTicketsService({
    assertCanAccessOrder: () => {},
    assertCanAccessTicket: () => {},
    computeSlaDeadlines: () => ({}),
    createError,
    ObjectId: makeObjectIdStub(),
    ticketsRepository: {
      findTicketById: async () => ({ _id: "t1", immutableOutcome: null, attachmentIds: [] }),
      findMediaByIds: async () => [],
    },
    SLA_FIRST_RESPONSE_MINUTES: 480,
    SLA_RESOLUTION_MINUTES: 2400,
    writeAuditLog: async () => {},
  });
  await assert.rejects(
    () =>
      service.resolveTicket({
        auth: { sub: "507f1f77bcf86cd799439011" },
        ticketId: { toString: () => "t1" },
        summaryText: "done",
        attachmentIds: ["m1"],
        parseObjectIdOrNull: (v) => ({ toString: () => v }),
        ObjectId: makeObjectIdStub(),
        req: {},
        writeAuditLog: async () => {},
      }),
    (err) => err.code === "MEDIA_NOT_FOUND",
  );
});

test("updateTicketStatus 404 on access error", async () => {
  const service = createTicketsService({
    assertCanAccessOrder: () => {},
    assertCanAccessTicket: () => { throw new Error("no"); },
    computeSlaDeadlines: () => ({}),
    createError,
    ObjectId: makeObjectIdStub(),
    ticketsRepository: { findTicketById: async () => ({ _id: "t1" }) },
    SLA_FIRST_RESPONSE_MINUTES: 480,
    SLA_RESOLUTION_MINUTES: 2400,
    writeAuditLog: async () => {},
  });
  await assert.rejects(
    () => service.updateTicketStatus({ auth: {}, ticketId: "t1", status: "open" }),
    (err) => err.code === "TICKET_NOT_FOUND",
  );
});

test("updateTicketStatus staff invalid transition returns 409", async () => {
  const service = createTicketsService({
    assertCanAccessOrder: () => {},
    assertCanAccessTicket: () => {},
    computeSlaDeadlines: () => ({}),
    createError,
    ObjectId: makeObjectIdStub(),
    ticketsRepository: {
      findTicketById: async () => ({ _id: "t1", status: "unknown_state", sla: {}, immutableOutcome: null }),
    },
    SLA_FIRST_RESPONSE_MINUTES: 480,
    SLA_RESOLUTION_MINUTES: 2400,
    writeAuditLog: async () => {},
  });
  await assert.rejects(
    () =>
      service.updateTicketStatus({
        auth: { sub: "u1", roles: ["administrator"] },
        ticketId: "t1",
        status: "open",
      }),
    (err) => err.code === "INVALID_STATUS_TRANSITION" && err.status === 409,
  );
});
