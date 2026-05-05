import { useCallback, useEffect, useState } from 'react'
import { listWorkspaces } from '../api/workspaces'
import type { WorkspaceSummary } from '../api/workspaces'
import { ApiError } from '../api/client'
import { navigate } from '../hooks/useRoute'
import { formatRelativeTime } from '../lib/format'
import { CreateWorkspaceForm } from './CreateWorkspaceForm'
import { CopyButton } from './CopyButton'
import { useErrorToast } from './Toast'

export interface WorkspaceListProps {
  onLogout: () => Promise<void>
  username: string
}

export function WorkspaceList({ onLogout, username }: WorkspaceListProps) {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  useErrorToast(error)

  const reload = useCallback(async (signal?: AbortSignal) => {
    setError(null)
    try {
      const ws = await listWorkspaces(signal)
      setWorkspaces(ws)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(err instanceof ApiError ? err.message : 'Konnte Workspaces nicht laden.')
    }
  }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    void reload(ctrl.signal)
    return () => ctrl.abort()
  }, [reload])

  return (
    <div className="page">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="brand">
            <span className="brand-dot" aria-hidden="true" />
            <span>Mahlzeit · Admin</span>
            <span className="hidden text-stone-300 sm:inline">·</span>
            <span className="hidden text-xs font-normal text-stone-500 sm:inline">
              {username}
            </span>
          </div>
          <button type="button" onClick={() => void onLogout()} className="btn-secondary btn-sm">
            Logout
          </button>
        </div>
      </header>

      <main className="page-container">
        <div className="flex items-center justify-between">
          <h1 className="h-page">Workspaces</h1>
          {!showCreate ? (
            <button type="button" onClick={() => setShowCreate(true)} className="btn-primary">
              + Neuen anlegen
            </button>
          ) : null}
        </div>

        {showCreate ? (
          <div className="mt-5">
            <CreateWorkspaceForm
              onCreated={() => void reload()}
              onClose={() => setShowCreate(false)}
            />
          </div>
        ) : null}

        <div className="mt-6">
          {workspaces === null ? (
            <WorkspaceListSkeleton />
          ) : workspaces.length === 0 ? (
            <div className="empty">
              Noch keine Workspaces angelegt. Klick oben auf{' '}
              <span className="font-medium text-stone-800">„+ Neuen anlegen"</span>, um den ersten
              anzulegen.
            </div>
          ) : (
            <>
              {/* Desktop / tablet: table */}
              <div className="card hidden overflow-hidden sm:block">
                <table className="w-full text-sm">
                  <thead className="bg-stone-50/70 text-xs uppercase tracking-wider text-stone-500">
                    <tr>
                      <th scope="col" className="px-5 py-3 text-left font-semibold">
                        Name
                      </th>
                      <th scope="col" className="px-5 py-3 text-right font-semibold">
                        Sessions
                      </th>
                      <th scope="col" className="px-5 py-3 text-left font-semibold">
                        Letzte Aktivität
                      </th>
                      <th scope="col" className="px-5 py-3 text-right font-semibold">
                        Aktionen
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200/70">
                    {workspaces.map((w) => (
                      <tr key={w.id} className="transition hover:bg-stone-50/70">
                        <td className="px-5 py-3.5">
                          <button
                            type="button"
                            onClick={() => navigate(`/workspaces/${w.id}`)}
                            className="font-medium text-stone-900 hover:text-orange-600"
                          >
                            {w.name}
                          </button>
                        </td>
                        <td className="px-5 py-3.5 text-right tabular-nums text-stone-700">
                          {w.stats.sessions_total}
                          {w.stats.sessions_open > 0 ? (
                            <span className="ml-1.5 badge-info">
                              {w.stats.sessions_open} offen
                            </span>
                          ) : null}
                        </td>
                        <td className="px-5 py-3.5 text-stone-600">
                          {formatRelativeTime(w.stats.last_activity)}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => navigate(`/workspaces/${w.id}`)}
                              className="btn-secondary btn-sm"
                            >
                              Öffnen
                            </button>
                            <CopyButton value={w.url} label="Link kopieren" />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: stacked cards */}
              <ul className="space-y-3 sm:hidden">
                {workspaces.map((w) => (
                  <li key={w.id} className="card p-4">
                    <button
                      type="button"
                      onClick={() => navigate(`/workspaces/${w.id}`)}
                      className="block w-full text-left"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="truncate font-medium text-stone-900">{w.name}</h3>
                        <span className="shrink-0 tabular-nums text-xs text-stone-600">
                          {w.stats.sessions_total} Sessions
                        </span>
                      </div>
                      {w.stats.sessions_open > 0 ? (
                        <span className="mt-1 inline-flex badge-info">
                          {w.stats.sessions_open} offen
                        </span>
                      ) : null}
                      <p className="mt-1.5 help-xs">
                        Letzte Aktivität: {formatRelativeTime(w.stats.last_activity)}
                      </p>
                    </button>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/workspaces/${w.id}`)}
                        className="btn-secondary btn-sm"
                      >
                        Öffnen
                      </button>
                      <CopyButton value={w.url} label="Link kopieren" />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

function WorkspaceListSkeleton() {
  return (
    <div className="card overflow-hidden" aria-busy="true" aria-label="Workspaces werden geladen">
      <ul className="divide-y divide-stone-200/70">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 animate-pulse rounded bg-stone-200" />
              <div className="h-3 w-1/4 animate-pulse rounded bg-stone-100" />
            </div>
            <div className="h-6 w-24 animate-pulse rounded bg-stone-100" />
          </li>
        ))}
      </ul>
    </div>
  )
}
