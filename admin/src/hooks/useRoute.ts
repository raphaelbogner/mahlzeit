import { useEffect, useState } from 'react'

// Tiny path-based router. Avoids pulling in react-router for a 3-route app.
// Matches: /login, /, /workspaces/:id (anything else is treated as not-found).

export type Route =
  | { name: 'login' }
  | { name: 'list' }
  | { name: 'detail'; id: number }
  | { name: 'not_found' }

export function parseRoute(pathname: string): Route {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/login') return { name: 'login' }
  if (path === '/' || path === '') return { name: 'list' }
  const m = /^\/workspaces\/(\d+)$/.exec(path)
  if (m) return { name: 'detail', id: Number(m[1]) }
  return { name: 'not_found' }
}

export function navigate(path: string): void {
  if (window.location.pathname === path) return
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.pathname))

  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.pathname))
    window.addEventListener('popstate', onChange)
    return () => window.removeEventListener('popstate', onChange)
  }, [])

  return route
}
