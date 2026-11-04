import type { ApiEnvelope, PaginationMeta, SessionPayload } from './types';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1').replace(
  /\/$/,
  '',
);

let accessToken: string | null = null;
let refreshPromise: Promise<SessionPayload | null> | null = null;

export class ApiRequestError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  requestId?: string;

  constructor(
    message: string,
    status: number,
    code?: string,
    details?: unknown,
    requestId?: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

function authHeaders(): Record<string, string> {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

export async function refreshAccessToken(): Promise<SessionPayload | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!response.ok) return null;
      const body = (await response.json()) as ApiEnvelope<SessionPayload>;
      if (!body.success || !body.data) return null;
      if (body.data.accessToken) setAccessToken(body.data.accessToken);
      return body.data;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  retry?: boolean;
}

interface EnvelopeResult<T> {
  response: Response;
  body: ApiEnvelope<T> | null;
}

async function sendEnvelope<T>(path: string, options: RequestOptions): Promise<EnvelopeResult<T>> {
  const { body, retry = true, headers, ...rest } = options;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  const response = await fetch(`${API_URL}${path.startsWith('/') ? path : `/${path}`}`, {
    ...rest,
    credentials: 'include',
    headers: {
      ...(isFormData ? {} : body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...authHeaders(),
      ...(headers as Record<string, string>),
    },
    body: body === undefined ? undefined : isFormData ? (body as FormData) : JSON.stringify(body),
  });

  if (response.status === 401 && retry && !path.startsWith('/auth/')) {
    const session = await refreshAccessToken();
    if (session) {
      return sendEnvelope<T>(path, { ...options, retry: false });
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('aurora:unauthorized'));
    }
  }

  const contentType = response.headers.get('content-type') ?? '';
  const parsed = contentType.includes('application/json')
    ? ((await response.json().catch(() => null)) as ApiEnvelope<T> | null)
    : null;

  if (!response.ok || (parsed && parsed.success === false)) {
    throw new ApiRequestError(
      parsed?.error || `Request failed (${response.status})`,
      response.status,
      parsed?.code,
      parsed?.details,
      parsed?.requestId,
    );
  }

  return { response, body: parsed };
}

/**
 * Mongoose `lean()` documents expose `_id` rather than the `id` virtual that
 * `toJSON()` produces. Normalise every payload so UI code can rely on `id`.
 */
export function normalizePayload<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => normalizePayload(item)) as unknown as T;
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const record = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(record)) {
      output[key] = normalizePayload(entry);
    }
    if (output.id === undefined && output._id !== undefined) {
      output.id = String(output._id);
    }
    return output as T;
  }
  return value;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body } = await sendEnvelope<T>(path, options);
  return normalizePayload(body?.data as T);
}

export async function apiList<T>(
  path: string,
  options: RequestOptions = {},
): Promise<{ data: T[]; meta: PaginationMeta | null }> {
  const { body } = await sendEnvelope<T[]>(path, options);
  return {
    data: normalizePayload(body?.data ?? []),
    meta: (body?.meta as PaginationMeta | undefined) ?? null,
  };
}

export async function apiBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  const { body, retry = true, headers, ...rest } = options;
  const response = await fetch(`${API_URL}${path.startsWith('/') ? path : `/${path}`}`, {
    ...rest,
    credentials: 'include',
    headers: { ...authHeaders(), ...(headers as Record<string, string>) },
    body: body as BodyInit | undefined,
  });

  if (response.status === 401 && retry) {
    const session = await refreshAccessToken();
    if (session) return apiBlob(path, { ...options, retry: false });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('aurora:unauthorized'));
    }
  }
  if (!response.ok) {
    throw new ApiRequestError(`Unable to download document (${response.status})`, response.status);
  }
  return response.blob();
}

export function buildQuery(params: Record<string, unknown> = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function downloadDocument(path: string, filename: string) {
  const blob = await apiBlob(path);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  get<T>(path: string, options?: RequestOptions) {
    return apiRequest<T>(path, { ...options, method: 'GET' });
  },
  list<T>(path: string, options?: RequestOptions) {
    return apiList<T>(path, { ...options, method: 'GET' });
  },
  post<T>(path: string, body?: unknown, options?: RequestOptions) {
    return apiRequest<T>(path, { ...options, method: 'POST', body });
  },
  patch<T>(path: string, body?: unknown, options?: RequestOptions) {
    return apiRequest<T>(path, { ...options, method: 'PATCH', body });
  },
  put<T>(path: string, body?: unknown, options?: RequestOptions) {
    return apiRequest<T>(path, { ...options, method: 'PUT', body });
  },
  delete<T>(path: string, options?: RequestOptions) {
    return apiRequest<T>(path, { ...options, method: 'DELETE' });
  },
};

export { API_URL };
