import { client } from '@/api/client';

export type AuthUser = {
  id: string;
  username: string;
  roles: string[];
};

export type LoginInput = { username: string; password: string };
export type RegisterInput = { username: string; password: string };

export function login(body: LoginInput) {
  return client.request<{ user: AuthUser }>({ method: 'POST', path: '/api/auth/login', body });
}

export function register(body: RegisterInput) {
  return client.request<{ user: AuthUser }>({ method: 'POST', path: '/api/auth/register', body });
}

export function refresh() {
  return client.request<{ user: AuthUser | null }>({ method: 'POST', path: '/api/auth/refresh' });
}

export function logout() {
  return client.request<void>({ method: 'POST', path: '/api/auth/logout' });
}

export function me() {
  return client.request<{ user: AuthUser }>({ method: 'GET', path: '/api/auth/me' });
}
