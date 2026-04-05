import { client } from '@/api/client';

export type InboxMessage = { id: string; title: string; body: string; isRead?: boolean; publishAt?: string; roles?: string[] };

export type StaffMessagePayload = {
  title: string;
  body: string;
  publishAt?: string;
  roles?: string[];
  recipientUserId?: string;
};

export type InboxResponse = { messages: InboxMessage[] };

export function listInbox() {
  return client.withAuth().request<InboxResponse>({ method: 'GET', path: '/api/inbox' }).then((response) => response.messages);
}

export function markInboxRead(id: string) {
  return client.withAuth().request({ method: 'POST', path: `/api/inbox/${id}/read` });
}

export function createStaffMessage(payload: StaffMessagePayload) {
  return client.withAuth().request<{ id: string }>({
    method: 'POST',
    path: '/api/staff/messages',
    body: payload,
  });
}
