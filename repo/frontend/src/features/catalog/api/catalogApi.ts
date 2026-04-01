import { client } from '@/api/client';

export type ServiceSummary = {
  id: string;
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  addOns?: string[];
};

export type ServiceDetail = ServiceSummary & {
  price?: number;
  durationMinutes?: number;
  rating?: number;
  reviewCount?: number;
  bundles?: ServiceBundle[];
};

export type ServiceBundle = {
  id: string;
  title: string;
  description?: string;
  pricing?: { discountPercent?: number };
  services?: Array<{ id: string; title: string; category?: string | null; durationMinutes?: number | null }>;
};

export type ServiceQuestion = {
  id: string;
  question: string;
  answer?: string;
};

export type ModerationQuestion = {
  id: string;
  serviceId?: string | null;
  question: string;
  createdAt?: string;
};

export type ServiceReview = {
  id: string;
  rating: number;
  text?: string;
  reviewerName?: string;
  verified?: boolean;
};

export type CatalogFilters = {
  category?: string;
  tags?: string;
};

type ServicesResponse = {
  services?: ServiceSummary[];
};

type ServiceResponse = {
  service?: ServiceDetail;
};

type ServiceQuestionsResponse = {
  questions?: ServiceQuestion[];
};

type ModerationQuestionsResponse = {
  questions?: ModerationQuestion[];
};

type ServiceReviewsResponse = {
  reviews?: ServiceReview[];
};

export function listServices(filters: CatalogFilters = {}) {
  return client.request<ServicesResponse>({
      method: 'GET',
      path: '/api/services',
      query: filters,
  }).then((response) => (Array.isArray(response?.services) ? response.services : []));
}

export function getService(id: string) {
  return client.request<ServiceResponse>({ method: 'GET', path: `/api/services/${id}` }).then((response) => response.service as ServiceDetail);
}

export function getServiceQuestions(id: string) {
  return client.request<ServiceQuestionsResponse>({ method: 'GET', path: `/api/services/${id}/questions` }).then((response) => (Array.isArray(response?.questions) ? response.questions : []));
}

export function submitServiceQuestion(id: string, question: string) {
  return client.withAuth().request<{ id: string; status: string }>({ method: 'POST', path: `/api/services/${id}/questions`, body: { question } });
}

export function listPendingQuestions() {
  return client.withAuth().request<ModerationQuestionsResponse>({ method: 'GET', path: '/api/moderation/questions' }).then((response) => (Array.isArray(response?.questions) ? response.questions : []));
}

export function publishQuestion(id: string, answer: string) {
  return client.withAuth().request({ method: 'POST', path: `/api/moderation/questions/${id}/publish`, body: { answer } });
}

export function rejectQuestion(id: string) {
  return client.withAuth().request({ method: 'POST', path: `/api/moderation/questions/${id}/reject` });
}

export function getServiceReviews(id: string) {
  return client.request<ServiceReviewsResponse>({ method: 'GET', path: `/api/services/${id}/reviews` }).then((response) => (Array.isArray(response?.reviews) ? response.reviews : []));
}
