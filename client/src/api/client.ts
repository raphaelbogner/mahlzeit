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

const TOKEN_STORAGE_KEY = 'mahlzeit.workspace.v1';

// The token comes from the shared link (?w=). It is also remembered per
// browser so an installed PWA can start from the home screen (whose start_url
// cannot carry the token) and still reach the right workspace.
export function getWorkspaceToken(): string | null {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('w');
  if (fromUrl && fromUrl.length > 0) {
    try {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, fromUrl);
    } catch {
      // storage unavailable: URL token still works for this page load
    }
    return fromUrl;
  }
  try {
    const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    return stored && stored.length > 0 ? stored : null;
  } catch {
    return null;
  }
}

// Put a remembered token back into the URL so in-app links (which copy the
// current search string) and shared links keep working. Call once on boot.
export function ensureTokenInUrl(): void {
  const params = new URLSearchParams(window.location.search);
  if (params.get('w')) return;
  const token = getWorkspaceToken();
  if (!token) return;
  params.set('w', token);
  const next = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
  window.history.replaceState(window.history.state, '', next);
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
