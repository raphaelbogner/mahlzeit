import { apiFetch, setCsrfToken } from './client'

export interface AdminUser {
  id: number
  username: string
}

export interface MeResponseLoggedIn {
  authenticated: true
  admin: AdminUser
  csrf_token: string
}

export interface MeResponseLoggedOut {
  authenticated: false
}

export type MeResponse = MeResponseLoggedIn | MeResponseLoggedOut

export interface LoginResponse {
  admin: AdminUser
  csrf_token: string
}

export async function login(username: string, password: string): Promise<AdminUser> {
  const res = await apiFetch<LoginResponse>('/admin/api/login', {
    method: 'POST',
    body: { username, password },
  })
  setCsrfToken(res.csrf_token)
  return res.admin
}

export async function logout(): Promise<void> {
  try {
    await apiFetch<void>('/admin/api/logout', { method: 'POST' })
  } finally {
    setCsrfToken(null)
  }
}

export async function fetchMe(signal?: AbortSignal): Promise<MeResponse> {
  const res = await apiFetch<MeResponse>('/admin/api/me', { signal })
  if (res.authenticated) {
    setCsrfToken(res.csrf_token)
  } else {
    setCsrfToken(null)
  }
  return res
}
