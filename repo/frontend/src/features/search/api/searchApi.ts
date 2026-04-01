import { client } from '@/api/client';

export type SearchResult = { id: string; type: 'service' | 'content'; title: string; summary?: string };

type SearchResponse = {
  results?: Array<{ id: string; type: 'service' | 'content'; title: string; snippet?: string }>;
};

export function search(term: string) {
  return client.request<SearchResponse>({ method: 'GET', path: '/api/search', query: { q: term } }).then((response) => (
    Array.isArray(response?.results)
      ? response.results.map((item) => ({
          id: item.id,
          type: item.type,
          title: item.title,
          summary: item.snippet,
        }))
      : []
  ));
}
