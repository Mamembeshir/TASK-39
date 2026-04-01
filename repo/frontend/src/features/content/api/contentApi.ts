import { client } from '@/api/client';

export type ContentArticle = { id: string; slug: string; title: string; summary?: string };
export type ContentArticleDetail = ContentArticle & {
  body?: string;
  status?: string;
  currentVersionId?: string | null;
  publishedVersionId?: string | null;
  versions?: Array<{ id: string; title: string; body: string; mediaIds: string[]; createdAt?: string }>;
};
export type ContentManageSummary = {
  id: string;
  slug: string;
  title: string;
  status?: string;
  publishedAt?: string | null;
  scheduledPublishAt?: string | null;
  currentVersionId?: string | null;
  publishedVersionId?: string | null;
};

export function listArticles() {
  return client.request<ContentArticle[]>({ method: 'GET', path: '/api/content' }).then((response) => (Array.isArray(response) ? response : []));
}

export function getArticle(id: string) {
  return client.request<ContentArticleDetail>({ method: 'GET', path: `/api/content/${id}` });
}

export function listManageArticles() {
  return client.withAuth().request<ContentManageSummary[]>({ method: 'GET', path: '/api/content/manage' }).then((response) => (Array.isArray(response) ? response : []));
}

export function createArticle(body: { slug: string; title: string; body: string; mediaIds?: string[] }) {
  return client.withAuth().request<{ id: string; versionId: string }>({ method: 'POST', path: '/api/content', body });
}

export function saveArticleDraft(id: string, body: { title: string; body: string; mediaIds?: string[] }) {
  return client.withAuth().request<{ id: string; currentVersionId: string }>({ method: 'PATCH', path: `/api/content/${id}/draft`, body });
}

export function scheduleArticle(id: string, body: { publishAt: string; versionId?: string | null }) {
  return client.withAuth().request({ method: 'POST', path: `/api/content/${id}/schedule`, body });
}

export function publishArticle(id: string, body: { versionId?: string | null }) {
  return client.withAuth().request({ method: 'POST', path: `/api/content/${id}/publish`, body });
}

export function rollbackArticle(id: string, body: { versionId: string }) {
  return client.withAuth().request({ method: 'POST', path: `/api/content/${id}/rollback`, body });
}
