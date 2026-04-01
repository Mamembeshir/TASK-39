import { client } from '@/api/client';

export type TicketSla = {
  firstResponseDueAt?: string;
  resolutionDueAt?: string;
  isPaused?: boolean;
  pausedAt?: string;
};

export type TicketImmutableOutcome = {
  resolvedAt?: string;
  summaryText?: string;
  attachmentIds?: string[];
  resolvedByUserId?: string;
};

export type TicketDetail = {
  id: string;
  orderId: string;
  customerId?: string | null;
  status?: string;
  legalHold?: boolean;
  category?: string;
  description?: string;
  attachmentIds?: string[];
  sla?: TicketSla;
  immutableOutcome?: TicketImmutableOutcome;
};

export type TicketCreateInput = {
  orderId: string;
  category: string;
  description: string;
  attachmentIds?: string[];
};

export function createTicket(body: TicketCreateInput) {
  return client.withAuth().request<TicketDetail>({ method: 'POST', path: '/api/tickets', body });
}

export function listTickets() {
  return client.withAuth().request<TicketDetail[]>({ method: 'GET', path: '/api/tickets' }).then((response) => (Array.isArray(response) ? response : []));
}

export function getTicket(id: string) {
  return client.withAuth().request<{ ticket?: TicketDetail }>({ method: 'GET', path: `/api/tickets/${id}` }).then((response) => response.ticket as TicketDetail);
}

export function uploadTicketAttachments(files: File[]) {
  const formData = new FormData();
  formData.set('purpose', 'ticket');
  files.forEach((file) => formData.append('files', file));
  return client.withAuth().request<{ media?: Array<{ mediaId: string }> }>({ method: 'POST', path: '/api/media', formData }).then((response) => ({
    mediaIds: Array.isArray(response?.media) ? response.media.map((item) => item.mediaId) : [],
  }));
}

export function updateTicketStatus(id: string, status: string) {
  return client.withAuth().request<{ status: string }>({ method: 'POST', path: `/api/tickets/${id}/status`, body: { status } });
}

export function setTicketLegalHold(id: string, legalHold: boolean) {
  return client.withAuth().request<{ legalHold: boolean }>({ method: 'POST', path: `/api/tickets/${id}/legal-hold`, body: { legalHold } });
}

export function resolveTicket(id: string, body: { summaryText: string; attachmentIds?: string[] }) {
  return client.withAuth().request({ method: 'POST', path: `/api/tickets/${id}/resolve`, body });
}
