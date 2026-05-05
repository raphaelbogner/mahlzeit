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
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Mahlzeit · Admin
            </h1>
            <p className="text-xs text-neutral-500">Eingeloggt als {username}</p>
          </div>
          <button
            type="button"
            onClick={() => void onLogout()}
            className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            Workspaces
          </h2>
          {!showCreate ? (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="rounded bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700"
            >
              + Neuen anlegen
            </button>
          ) : null}
        </div>

        {showCreate ? (
          <div className="mt-4">
            <CreateWorkspaceForm
              onCreated={() => void reload()}
              onClose={() => setShowCreate(false)}
            />
          </div>
        ) : null}

        <div className="mt-4">
          {workspaces === null ? (
            <WorkspaceListSkeleton />
          ) : workspaces.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
              Noch keine Workspaces angelegt. Klick oben auf
              {' '}<span className="font-medium">„+ Neuen anlegen"</span>, um den ersten anzulegen.
            </div>
          ) : (
            <>
              {/* Desktop / tablet: table */}
              <div className="hidden overflow-hidden rounded-lg border border-neutral-200 bg-white sm:block dark:border-neutral-800 dark:bg-neutral-900">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-950">
                    <tr>
                      <th scope="col" className="px-4 py-2 text-left font-medium">Name</th>
                      <th scope="col" className="px-4 py-2 text-right font-medium">Sessions</th>
                      <th scope="col" className="px-4 py-2 text-left font-medium">Letzte Aktivität</th>
                      <th scope="col" className="px-4 py-2 text-right font-medium">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {workspaces.map((w) => (
                      <tr key={w.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => navigate(`/workspaces/${w.id}`)}
                            className="font-medium text-violet-700 hover:underline dark:text-violet-300"
                          >
                            {w.name}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-neutral-700 dark:text-neutral-200">
                          {w.stats.sessions_total}
                          {w.stats.sessions_open > 0 ? (
                            <span className="ml-1 text-xs text-violet-600">
                              ({w.stats.sessions_open} offen)
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-neutral-600 dark:text-neutral-300">
                          {formatRelativeTime(w.stats.last_activity)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => navigate(`/workspaces/${w.id}`)}
                              className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200"
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
              <ul className="space-y-2 sm:hidden">
                {workspaces.map((w) => (
                  <li
                    key={w.id}
                    className="rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
                  >
                    <button
                      type="button"
                      onClick={() => navigate(`/workspaces/${w.id}`)}
                      className="block w-full text-left"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="truncate font-medium text-violet-700 dark:text-violet-300">
                          {w.name}
                        </h3>
                        <span className="shrink-0 tabular-nums text-xs text-neutral-600 dark:text-neutral-300">
                          {w.stats.sessions_total} Sessions
                          {w.stats.sessions_open > 0 ? (
                            <span className="ml-1 text-violet-600">({w.stats.sessions_open} offen)</span>
                          ) : null}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-neutral-500">
                        Letzte Aktivität: {formatRelativeTime(w.stats.last_activity)}
                      </p>
                    </button>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/workspaces/${w.id}`)}
                        className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200"
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
    <div
      className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
      aria-busy="true"
      aria-label="Workspaces werden geladen"
    >
      <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
              <div className="h-3 w-1/4 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800/60" />
            </div>
            <div className="h-6 w-24 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800/60" />
          </li>
        ))}
      </ul>
    </div>
  )
}
