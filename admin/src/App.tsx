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
      <div className="flex min-h-screen items-center justify-center bg-stone-50 text-sm text-stone-500">
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
    <div className="flex min-h-screen items-center justify-center bg-stone-50 p-4">
      <div className="card-pad text-center">
        <p className="help">Seite nicht gefunden.</p>
        <button type="button" onClick={() => navigate('/')} className="btn-primary mt-3">
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
