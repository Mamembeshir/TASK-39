function createTicketsController(deps) {
  const { createError, ObjectId, parseObjectIdOrNull, ticketsService, writeAuditLog } = deps;

  return {
    createTicket: async (req, res, next) => {
      try {
        const result = await ticketsService.createTicket({
          auth: req.auth,
          headers: req.headers,
          payload: {
            ...req.body,
            parseObjectIdOrNull,
          },
        });

        return res.status(201).json(result);
      } catch (error) {
        return next(error);
      }
    },

    getTicketById: async (req, res, next) => {
      try {
        const ticketId = parseObjectIdOrNull(req.params.id);
        if (!ticketId) {
          return next(createError(400, "INVALID_TICKET_ID", "Ticket id is invalid"));
        }

        const result = await ticketsService.getTicketById({ auth: req.auth, ticketId });
        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },

    listTickets: async (req, res, next) => {
      try {
        const result = await ticketsService.listTickets({
          auth: req.auth,
          ObjectId,
        });

        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },

    updateTicketStatus: async (req, res, next) => {
      try {
        const ticketId = parseObjectIdOrNull(req.params.id);
        if (!ticketId) {
          return next(createError(400, "INVALID_TICKET_ID", "Ticket id is invalid"));
        }

        const { status } = req.body || {};
        if (!status || typeof status !== "string") {
          return next(createError(400, "INVALID_STATUS", "status is required"));
        }

        const result = await ticketsService.updateTicketStatus({
          auth: req.auth,
          req,
          status,
          ticketId,
        });

        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },

    setTicketLegalHold: async (req, res, next) => {
      try {
        const ticketId = parseObjectIdOrNull(req.params.id);
        if (!ticketId) {
          return next(createError(400, "INVALID_TICKET_ID", "Ticket id is invalid"));
        }

        const legalHold = Boolean(req.body?.legalHold);
        const result = await ticketsService.setTicketLegalHold({ auth: req.auth, legalHold, req, ticketId });
        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },

    resolveTicket: async (req, res, next) => {
      try {
        const ticketId = parseObjectIdOrNull(req.params.id);
        if (!ticketId) {
          return next(createError(400, "INVALID_TICKET_ID", "Ticket id is invalid"));
        }

        const { summaryText, attachmentIds } = req.body || {};
        if (!summaryText || typeof summaryText !== "string") {
          return next(createError(400, "INVALID_SUMMARY", "summaryText is required"));
        }

        const result = await ticketsService.resolveTicket({
          attachmentIds,
          auth: req.auth,
          ObjectId,
          parseObjectIdOrNull,
          req,
          summaryText,
          ticketId,
          writeAuditLog,
        });

        return res.status(200).json(result);
      } catch (error) {
        return next(error);
      }
    },
  };
}

module.exports = {
  createTicketsController,
};
