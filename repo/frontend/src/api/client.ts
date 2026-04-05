import { env } from '@/config/env';
import type { ApiError } from '@/api/types/api-error';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type QueryValue = string | number | boolean | null | undefined;

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type RequestOptions = {
  method: HttpMethod;
  path: string;
  body?: JsonValue;
  formData?: FormData;
  query?: Record<string, QueryValue>;
  headers?: HeadersInit;
  signal?: AbortSignal;
  credentials?: RequestCredentials;
};

type UnauthorizedHandler = () => void;

let onUnauthorized: UnauthorizedHandler | null = null;
let unauthorizedHandlerInFlight = false;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toApiError(error: unknown, fallbackCode: string, fallbackMessage: string): ApiError {
  if (isObject(error)) {
    const code = typeof error.code === 'string' ? error.code : fallbackCode;
    const message = typeof error.message === 'string' ? error.message : fallbackMessage;
    return {
      ...error,
      code,
      message,
      details: 'details' in error ? error.details : undefined,
    };
  }

  return { code: fallbackCode, message: fallbackMessage };
}

function ensureValidPath(path: string) {
  if (!path.startsWith('/')) {
    throw new Error('API path must start with a leading slash');
  }

  if (!path.startsWith('/api')) {
    throw new Error('API path must begin with /api');
  }

  if (/^\/api\/api(\/|$)/.test(path)) {
    throw new Error('API path must not contain duplicate /api prefix');
  }
}

function buildPathWithQuery(path: string, query: Record<string, QueryValue> | undefined) {
  if (!query) {
    return path;
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined) {
      continue;
    }
    params.set(key, String(value));
  }

  const queryString = params.toString();
  return queryString.length > 0 ? `${path}?${queryString}` : path;
}

function readCookie(name: string) {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function shouldTriggerUnauthorizedHandler(path: string, status: number) {
  if (status !== 401 || !onUnauthorized) {
    return false;
  }

  return !path.startsWith('/api/auth/');
}

function triggerUnauthorizedHandler() {
  if (!onUnauthorized || unauthorizedHandlerInFlight) {
    return;
  }

  unauthorizedHandlerInFlight = true;
  queueMicrotask(() => {
    try {
      onUnauthorized?.();
    } finally {
      unauthorizedHandlerInFlight = false;
    }
  });
}

async function request<T>(options: RequestOptions): Promise<T> {
  ensureValidPath(options.path);

  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');

  let requestBody: string | undefined;
  if (options.formData) {
    requestBody = undefined;
  } else if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    requestBody = JSON.stringify(options.body);
  }

  const requestInit: RequestInit = {
    method: options.method,
    headers,
    body: options.formData ?? requestBody,
    signal: options.signal,
    credentials: options.credentials ?? 'include',
  };

  const csrfToken = readCookie('csrf_token');
  if (csrfToken && options.method !== 'GET') {
    headers.set('X-CSRF-Token', csrfToken);
  }

  let response: Response;
  try {
    response = await fetch(
      `${env.VITE_API_BASE_URL}${buildPathWithQuery(options.path, options.query)}`,
      requestInit,
    );
  } catch {
    throw toApiError(undefined, 'NETWORK_ERROR', 'Network request failed');
  }

  const text = await response.text();
  let data: unknown = null;
  if (text.length > 0) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    if (shouldTriggerUnauthorizedHandler(options.path, response.status)) {
      triggerUnauthorizedHandler();
    }

    throw toApiError(
      data,
      `HTTP_${response.status}`,
      `Request failed with status ${response.status}`,
    );
  }

  return data as T;
}

export function setOnUnauthorized(handler: UnauthorizedHandler | null) {
  onUnauthorized = handler;
  unauthorizedHandlerInFlight = false;
}

export const client = {
  request,
  withAuth() { return { request }; },
};
