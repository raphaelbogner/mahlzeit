import type { ApiErrorBody } from '../types/api';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function getWorkspaceToken(): string | null {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('w');
  return token && token.length > 0 ? token : null;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

const API_BASE = '/api';

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const token = getWorkspaceToken();
  if (!token) {
    throw new ApiError(401, 'NO_TOKEN', 'No workspace token in URL');
  }

  const headers: Record<string, string> = {
    'X-Workspace-Token': token,
    Accept: 'application/json',
  };
  let body: string | undefined;
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body,
      signal: opts.signal,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Network request failed');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('Content-Type') ?? '';
  const isJson = contentType.toLowerCase().includes('application/json');
  const text = await response.text();
  let parsed: unknown = null;
  if (text && isJson) {
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new ApiError(
        response.status,
        'INVALID_JSON',
        `Backend lieferte ungültiges JSON (HTTP ${response.status}).`,
      );
    }
  }

  if (!response.ok) {
    const err = parsed as ApiErrorBody | null;
    const code = err?.error?.code ?? 'HTTP_ERROR';
    const message =
      err?.error?.message ??
      (isJson
        ? `Anfrage fehlgeschlagen (HTTP ${response.status}).`
        : `Backend nicht erreichbar (HTTP ${response.status}).`);
    throw new ApiError(response.status, code, message);
  }

  if (!isJson) {
    throw new ApiError(
      response.status,
      'INVALID_JSON',
      `Backend lieferte kein JSON (Content-Type: ${contentType || 'leer'}).`,
    );
  }

  return parsed as T;
}
