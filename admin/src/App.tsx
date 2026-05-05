import { useCallback } from 'react'
import { useAuth } from './hooks/useAuth'
import { navigate, useRoute } from './hooks/useRoute'
import { LoginForm } from './components/LoginForm'
import { WorkspaceList } from './components/WorkspaceList'
import { WorkspaceDetail } from './components/WorkspaceDetail'
import { ToastProvider } from './components/Toast'

function AppInner() {
  const auth = useAuth()
  const route = useRoute()

  const handleLogin = useCallback(
    async (username: string, password: string) => {
      await auth.login(username, password)
      const returnTo = window.location.pathname === '/login' ? '/' : window.location.pathname
      navigate(returnTo)
    },
    [auth]
  )

  const handleLogout = useCallback(async () => {
    await auth.logout()
    navigate('/login')
  }, [auth])

  if (auth.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 text-sm text-neutral-500 dark:bg-neutral-950">
        Lade…
      </div>
    )
  }

  if (auth.status === 'anonymous') {
    if (route.name !== 'login' && window.location.pathname !== '/login') {
      navigate('/login')
    }
    return <LoginForm onLogin={handleLogin} />
  }

  // Authenticated.
  if (route.name === 'login') {
    navigate('/')
    return null
  }

  if (route.name === 'detail') {
    return (
      <WorkspaceDetail
        id={route.id}
        onLogout={handleLogout}
        username={auth.admin?.username ?? ''}
      />
    )
  }

  if (route.name === 'list') {
    return (
      <WorkspaceList
        onLogout={handleLogout}
        username={auth.admin?.username ?? ''}
      />
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-950">
      <div className="rounded-lg border border-neutral-200 bg-white p-6 text-center dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-sm text-neutral-600 dark:text-neutral-300">Seite nicht gefunden.</p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-3 rounded bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700"
        >
          Zur Übersicht
        </button>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  )
}
