import { useCallback, useEffect, useState } from 'react'
import { fetchMe, login as apiLogin, logout as apiLogout } from '../api/auth'
import type { AdminUser } from '../api/auth'
import { ApiError } from '../api/client'

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

export interface UseAuth {
  status: AuthStatus
  admin: AdminUser | null
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export function useAuth(): UseAuth {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [admin, setAdmin] = useState<AdminUser | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    fetchMe(ctrl.signal)
      .then((res) => {
        if (res.authenticated) {
          setAdmin(res.admin)
          setStatus('authenticated')
        } else {
          setAdmin(null)
          setStatus('anonymous')
        }
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.code === 'NETWORK') {
          // Surface network failure as anonymous so the login form can render.
          setAdmin(null)
          setStatus('anonymous')
          return
        }
        if (err instanceof DOMException && err.name === 'AbortError') return
        setAdmin(null)
        setStatus('anonymous')
      })
    return () => ctrl.abort()
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const user = await apiLogin(username, password)
    setAdmin(user)
    setStatus('authenticated')
  }, [])

  const logout = useCallback(async () => {
    await apiLogout()
    setAdmin(null)
    setStatus('anonymous')
  }, [])

  return { status, admin, login, logout }
}
