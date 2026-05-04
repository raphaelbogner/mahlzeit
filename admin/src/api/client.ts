// Fetch wrapper for the admin API.
// - credentials: 'include' so the session cookie flows on every request
// - X-CSRF-Token automatically attached for state-changing methods
// - Errors normalized into a typed ApiError

export interface ApiErrorBody {
  error: { code: string; message: string }
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
    this.name = 'ApiError'
  }
}

let csrfToken: string | null = null

export function setCsrfToken(token: string | null): void {
  csrfToken = token
}

export function getCsrfToken(): string | null {
  return csrfToken
}

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

interface RequestOptions {
  method?: string
  body?: unknown
  signal?: AbortSignal
}

interface MeProbe {
  authenticated: boolean
  csrf_token?: string
}

// Refresh the CSRF token from the server. Used to recover from CSRF mismatches
// caused by HMR resets, lost module state, or token rotation.
async function refreshCsrfFromMe(): Promise<boolean> {
  try {
    const res = await fetch('/admin/api/me', { credentials: 'include' })
    if (!res.ok) return false
    const data = (await res.json()) as MeProbe
    if (data.authenticated && typeof data.csrf_token === 'string') {
      csrfToken = data.csrf_token
      return true
    }
  } catch {
    // ignore — caller will surface the original error
  }
  return false
}

async function doFetch(
  path: string,
  method: string,
  body: BodyInit | undefined,
  contentType: string | undefined,
  signal: AbortSignal | undefined
): Promise<Response> {
  const headers: Record<string, string> = {}
  if (contentType) headers['Content-Type'] = contentType
  if (STATE_CHANGING.has(method) && csrfToken !== null) {
    headers['X-CSRF-Token'] = csrfToken
  }
  return fetch(path, { method, headers, body, credentials: 'include', signal })
}

export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const method = (opts.method ?? 'GET').toUpperCase()
  let body: BodyInit | undefined
  let contentType: string | undefined
  if (opts.body !== undefined) {
    contentType = 'application/json'
    body = JSON.stringify(opts.body)
  }

  let res: Response
  try {
    res = await doFetch(path, method, body, contentType, opts.signal)
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    if (err instanceof Error && err.name === 'AbortError') throw err
    throw new ApiError(0, 'NETWORK', err instanceof Error ? err.message : 'Network error')
  }

  // CSRF mismatch on a state-changing request? Refresh the token and retry once.
  if (res.status === 403 && STATE_CHANGING.has(method)) {
    const cloned = res.clone()
    let isCsrf = false
    try {
      const data = (await cloned.json()) as ApiErrorBody | null
      isCsrf = data?.error?.code === 'CSRF'
    } catch {
      // not JSON — treat as not csrf
    }
    if (isCsrf && (await refreshCsrfFromMe())) {
      try {
        res = await doFetch(path, method, body, contentType, opts.signal)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') throw err
        if (err instanceof Error && err.name === 'AbortError') throw err
        throw new ApiError(0, 'NETWORK', err instanceof Error ? err.message : 'Network error')
      }
    }
  }

  if (res.status === 204) {
    return undefined as T
  }

  let data: unknown = null
  const text = await res.text()
  if (text !== '') {
    try {
      data = JSON.parse(text)
    } catch {
      throw new ApiError(res.status, 'BAD_RESPONSE', 'Server returned non-JSON response.')
    }
  }

  if (!res.ok) {
    const e = (data as ApiErrorBody | null)?.error
    throw new ApiError(
      res.status,
      e?.code ?? 'HTTP_' + res.status,
      e?.message ?? 'Request failed.'
    )
  }

  return data as T
}
