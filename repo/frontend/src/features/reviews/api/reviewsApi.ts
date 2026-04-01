import { client } from '@/api/client';

export type ReviewInput = {
  orderId: string;
  rating: number;
  text: string;
  tags: string[];
  mediaIds: string[];
};

export function submitReview(input: ReviewInput) {
  return client.withAuth().request({
    method: 'POST',
    path: '/api/reviews',
    body: {
      orderId: input.orderId,
      rating: input.rating,
      text: input.text,
      tags: input.tags,
      mediaIds: input.mediaIds,
    },
  });
}

export function uploadReviewMedia(files: File[]) {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  formData.set('purpose', 'review');
  return client.withAuth().request<{ media: Array<{ mediaId: string }> }>({ method: 'POST', path: '/api/media', formData });
}
