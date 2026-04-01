import { client } from '@/api/client';

export type AuditLog = {
  id: string;
  who?: string | null;
  action: string;
  when: string;
  metadata?: {
    username?: string | null;
    ip?: string | null;
    userAgent?: string | null;
    outcome?: string | null;
  };
};

export type BlacklistEntry = {
  id: string;
  type: 'ip' | 'user';
  value: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export function listAuditLogs() {
  return client.withAuth().request<AuditLog[]>({ method: 'GET', path: '/api/admin/audit' }).then((response) => (Array.isArray(response) ? response : []));
}

export function listBlacklist() {
  return client.withAuth().request<BlacklistEntry[]>({ method: 'GET', path: '/api/admin/blacklist' }).then((response) => (Array.isArray(response) ? response : []));
}

export function upsertBlacklist(body: { type: 'ip' | 'user'; value: string; active: boolean }) {
  return client.withAuth().request<{ status: string }>({ method: 'POST', path: '/api/admin/blacklist', body });
}
