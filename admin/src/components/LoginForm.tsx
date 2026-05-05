import { useState } from 'react'
import { ApiError } from '../api/client'

export interface LoginFormProps {
  onLogin: (username: string, password: string) => Promise<void>
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await onLogin(username, password)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'RATE_LIMITED') {
          setError('Zu viele Login-Versuche. Bitte später erneut versuchen.')
        } else if (err.code === 'INVALID_CREDENTIALS') {
          setError('Username oder Passwort falsch.')
        } else if (err.code === 'NETWORK') {
          setError('Server nicht erreichbar.')
        } else {
          setError(err.message)
        }
      } else {
        setError('Login fehlgeschlagen.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 p-4">
      <form onSubmit={submit} className="w-full max-w-sm card-pad animate-fade-in-up">
        <div className="mb-5 flex items-center gap-2">
          <span className="brand-dot" aria-hidden="true" />
          <h1 className="text-lg font-semibold tracking-tight text-stone-900">
            Mahlzeit · Admin
          </h1>
        </div>
        <p className="help -mt-2 mb-5">Bitte einloggen.</p>

        <div>
          <label htmlFor="username" className="label">
            Username
          </label>
          <input
            id="username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="input"
          />
        </div>

        <div className="mt-4">
          <label htmlFor="password" className="label">
            Passwort
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="input"
          />
        </div>

        {error ? (
          <div className="alert-error mt-4" role="alert">
            {error}
          </div>
        ) : null}

        <button type="submit" disabled={busy} className="btn-primary mt-6 w-full">
          {busy ? 'Bitte warten…' : 'Login'}
        </button>
      </form>
    </div>
  )
}
