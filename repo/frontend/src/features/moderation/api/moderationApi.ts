import { client } from '@/api/client';

export type ModerationReview = { id: string; text: string; status: string; rating: number; orderId?: string; createdAt?: string };

export function listModerationQueue() {
  return client.withAuth().request<ModerationReview[]>({ method: 'GET', path: '/api/moderation/reviews' }).then((response) => (Array.isArray(response) ? response : []));
}

export function approveReview(id: string) {
  return client.withAuth().request({ method: 'POST', path: `/api/moderation/reviews/${id}/approve` });
}

export function rejectReview(id: string) {
  return client.withAuth().request({ method: 'POST', path: `/api/moderation/reviews/${id}/reject` });
}
