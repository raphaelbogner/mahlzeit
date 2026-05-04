import { useCallback, useEffect, useState } from 'react'
import {
  deleteWorkspace,
  getWorkspace,
  renameWorkspace,
  rotateWorkspaceToken,
} from '../api/workspaces'
import type { WorkspaceDetail as WorkspaceDetailData } from '../api/workspaces'
import { ApiError } from '../api/client'
import { navigate } from '../hooks/useRoute'
import { formatDateTime, formatRelativeTime } from '../lib/format'
import { CopyButton } from './CopyButton'
import { ConfirmDialog } from './ConfirmDialog'

export interface WorkspaceDetailProps {
  id: number
  onLogout: () => Promise<void>
  username: string
}

type DialogKind = 'rotate' | 'delete' | null

export function WorkspaceDetail({ id, onLogout, username }: WorkspaceDetailProps) {
  const [workspace, setWorkspace] = useState<WorkspaceDetailData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [editingName, setEditingName] = useState('')
  const [dialog, setDialog] = useState<DialogKind>(null)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(
    async (signal?: AbortSignal) => {
      setError(null)
      try {
        const ws = await getWorkspace(id, signal)
        setWorkspace(ws)
        setEditingName(ws.name)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof ApiError ? err.message : 'Konnte Workspace nicht laden.')
      }
    },
    [id]
  )

  useEffect(() => {
    const ctrl = new AbortController()
    void reload(ctrl.signal)
    return () => ctrl.abort()
  }, [reload])

  async function saveName() {
    if (!workspace) return
    const trimmed = editingName.trim()
    if (trimmed === '' || trimmed === workspace.name) {
      setRenaming(false)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const ws = await renameWorkspace(id, trimmed)
      setWorkspace(ws)
      setRenaming(false)
      setNotice('Name aktualisiert.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Umbenennen fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  async function confirmRotate() {
    setBusy(true)
    setError(null)
    try {
      const ws = await rotateWorkspaceToken(id)
      setWorkspace(ws)
      setDialog(null)
      setNotice('Token rotiert. Der alte Link funktioniert nicht mehr.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Token-Rotation fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    setBusy(true)
    setError(null)
    try {
      await deleteWorkspace(id)
      setDialog(null)
      navigate('/')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Löschen fehlgeschlagen.')
      setBusy(false)
    }
  }

  if (workspace === null && error === null) {
    return (
      <div className="min-h-screen bg-neutral-50 p-6 text-sm text-neutral-500 dark:bg-neutral-950">
        Lade Workspace…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="text-sm text-violet-700 hover:underline dark:text-violet-300"
              aria-label="Zurück zur Übersicht"
            >
              ← Zurück
            </button>
            {workspace ? (
              renaming ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    maxLength={120}
                    className="rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
                  />
                  <button
                    type="button"
                    onClick={() => void saveName()}
                    disabled={busy}
                    className="rounded bg-violet-600 px-2 py-1 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    Speichern
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRenaming(false)
                      setEditingName(workspace.name)
                    }}
                    disabled={busy}
                    className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200"
                  >
                    Abbrechen
                  </button>
                </div>
              ) : (
                <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                  {workspace.name}
                </h1>
              )
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void onLogout()}
            className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200"
            aria-label={`Logout (${username})`}
          >
            Logout
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-6">
        {notice ? (
          <div className="mb-4 rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
            {notice}
          </div>
        ) : null}
        {error ? (
          <div
            className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        {workspace ? (
          <>
            <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                Share-Link
              </h3>
              <div className="mt-2 flex items-center gap-2 rounded border border-neutral-200 bg-neutral-50 p-2 dark:border-neutral-700 dark:bg-neutral-800">
                <code className="flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs text-neutral-800 dark:text-neutral-200">
                  {workspace.url}
                </code>
                <CopyButton value={workspace.url} label="Kopieren" />
              </div>
              <p className="mt-2 text-xs text-neutral-500">
                Wer den Link hat, hat vollen Zugriff auf den Workspace. Bitte
                nicht in öffentlichen Kanälen teilen.
              </p>
            </section>

            <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                Statistik
              </h3>
              <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm sm:grid-cols-3">
                <Stat label="Sessions gesamt" value={workspace.stats.sessions_total} />
                <Stat label="Davon offen" value={workspace.stats.sessions_open} />
                <Stat label="Items gesamt" value={workspace.stats.items_total} />
                <Stat label="Restaurants" value={workspace.stats.restaurants_total} />
                <Stat
                  label="Letzte Aktivität"
                  value={formatRelativeTime(workspace.stats.last_activity)}
                />
                <Stat label="Angelegt" value={formatDateTime(workspace.created_at)} />
              </dl>
            </section>

            <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                Aktive Nutzer ({workspace.active_users.length})
              </h3>
              <p className="mt-2 rounded bg-neutral-50 p-3 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                ⓘ Diese Liste zeigt alle Personen, die mindestens eine Bestellung
                eingetragen oder eine Sammelbestellung gestartet haben. Die
                Liste basiert auf Aktivität, nicht auf Mitgliedschaft. Personen
                mit gleichem Namen erscheinen als ein Eintrag.
              </p>
              {workspace.active_users.length === 0 ? (
                <p className="mt-3 text-sm text-neutral-500">Noch keine Aktivität.</p>
              ) : (
                <ul className="mt-3 divide-y divide-neutral-200 dark:divide-neutral-800">
                  {workspace.active_users.map((u) => (
                    <li
                      key={u.name}
                      className="flex items-center justify-between py-2 text-sm"
                    >
                      <span className="font-medium text-neutral-800 dark:text-neutral-100">
                        {u.name}
                      </span>
                      <span className="text-neutral-500">
                        {u.items_count} Items · zuletzt {formatRelativeTime(u.last_seen)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                Verwaltung
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setRenaming(true)}
                  disabled={renaming}
                  className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200"
                >
                  Name ändern
                </button>
                <button
                  type="button"
                  onClick={() => setDialog('rotate')}
                  className="rounded border border-amber-400 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                >
                  Token rotieren
                </button>
                <button
                  type="button"
                  onClick={() => setDialog('delete')}
                  className="rounded border border-red-400 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200"
                >
                  Workspace löschen
                </button>
              </div>
            </section>

            <ConfirmDialog
              open={dialog === 'rotate'}
              title="Token rotieren?"
              description={
                <>
                  Der bisherige Link funktioniert nach Bestätigung nicht mehr.
                  Alle Nutzer brauchen anschließend den neuen Link. Diese
                  Aktion kann nicht rückgängig gemacht werden.
                </>
              }
              confirmLabel="Token rotieren"
              destructive={true}
              busy={busy}
              onConfirm={() => void confirmRotate()}
              onCancel={() => setDialog(null)}
            />

            <ConfirmDialog
              open={dialog === 'delete'}
              title="Workspace löschen?"
              description={
                <>
                  Alle Daten dieses Workspaces werden unwiderruflich gelöscht:
                  Sessions, Items, Restaurants, Speisekarten. Diese Aktion kann
                  nicht rückgängig gemacht werden.
                </>
              }
              requireText={workspace.name}
              confirmLabel="Endgültig löschen"
              destructive={true}
              busy={busy}
              onConfirm={() => void confirmDelete()}
              onCancel={() => setDialog(null)}
            />
          </>
        ) : null}
      </main>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="text-base font-medium text-neutral-900 dark:text-neutral-100">{value}</dd>
    </div>
  )
}
