import { client } from '@/api/client';

export type InboxMessage = { id: string; title: string; body: string; isRead?: boolean; publishAt?: string; roles?: string[] };

export type InboxResponse = { messages: InboxMessage[] };

export function listInbox() {
  return client.withAuth().request<InboxResponse>({ method: 'GET', path: '/api/inbox' }).then((response) => response.messages);
}

export function markInboxRead(id: string) {
  return client.withAuth().request({ method: 'POST', path: `/api/inbox/${id}/read` });
}
