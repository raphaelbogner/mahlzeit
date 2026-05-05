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
import { useToast } from './Toast'

export interface WorkspaceDetailProps {
  id: number
  onLogout: () => Promise<void>
  username: string
}

type DialogKind = 'rotate' | 'delete' | null

export function WorkspaceDetail({ id, onLogout, username }: WorkspaceDetailProps) {
  const [workspace, setWorkspace] = useState<WorkspaceDetailData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [editingName, setEditingName] = useState('')
  const [dialog, setDialog] = useState<DialogKind>(null)
  const [busy, setBusy] = useState(false)
  const { showError, showSuccess } = useToast()

  const reload = useCallback(
    async (signal?: AbortSignal) => {
      setLoadError(null)
      try {
        const ws = await getWorkspace(id, signal)
        setWorkspace(ws)
        setEditingName(ws.name)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        const msg = err instanceof ApiError ? err.message : 'Konnte Workspace nicht laden.'
        setLoadError(msg)
        showError(msg)
      }
    },
    [id, showError]
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
    try {
      const ws = await renameWorkspace(id, trimmed)
      setWorkspace(ws)
      setRenaming(false)
      showSuccess('Name aktualisiert.')
    } catch (err) {
      showError(err instanceof ApiError ? err.message : 'Umbenennen fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  async function confirmRotate() {
    setBusy(true)
    try {
      const ws = await rotateWorkspaceToken(id)
      setWorkspace(ws)
      setDialog(null)
      showSuccess('Token rotiert. Der alte Link funktioniert nicht mehr.')
    } catch (err) {
      showError(err instanceof ApiError ? err.message : 'Token-Rotation fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    setBusy(true)
    try {
      await deleteWorkspace(id)
      setDialog(null)
      navigate('/')
    } catch (err) {
      showError(err instanceof ApiError ? err.message : 'Löschen fehlgeschlagen.')
      setBusy(false)
    }
  }

  if (workspace === null) {
    return (
      <div className="page">
        <header className="app-header">
          <div className="app-header-inner">
            <button type="button" onClick={() => navigate('/')} className="btn-link">
              ← Zurück
            </button>
            <button
              type="button"
              onClick={() => void onLogout()}
              className="btn-secondary btn-sm"
            >
              Logout
            </button>
          </div>
        </header>
        <main className="page-container" aria-busy="true">
          {loadError ? (
            <div className="alert-error">
              {loadError}
              <div className="mt-3">
                <button type="button" onClick={() => void reload()} className="btn-secondary btn-sm">
                  Erneut versuchen
                </button>
              </div>
            </div>
          ) : (
            <WorkspaceDetailSkeleton />
          )}
        </main>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="btn-link"
              aria-label="Zurück zur Übersicht"
            >
              ← Zurück
            </button>
            {renaming ? (
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="rename-input" className="sr-only">
                  Neuer Workspace-Name
                </label>
                <input
                  id="rename-input"
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  maxLength={120}
                  className="input max-w-xs"
                />
                <button
                  type="button"
                  onClick={() => void saveName()}
                  disabled={busy}
                  className="btn-primary btn-sm"
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
                  className="btn-secondary btn-sm"
                >
                  Abbrechen
                </button>
              </div>
            ) : (
              <h1 className="truncate text-lg font-semibold tracking-tight text-stone-900">
                {workspace.name}
              </h1>
            )}
          </div>
          <button
            type="button"
            onClick={() => void onLogout()}
            className="btn-secondary btn-sm"
            aria-label={`Logout (${username})`}
          >
            Logout
          </button>
        </div>
      </header>

      <main className="page-container space-y-6">
        <section className="card-pad">
          <h3 className="h-card">Share-Link</h3>
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-stone-50 p-2 ring-1 ring-stone-200">
            <code className="flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs text-stone-800">
              {workspace.url}
            </code>
            <CopyButton value={workspace.url} label="Kopieren" />
          </div>
          <p className="mt-2 help-xs">
            Wer den Link hat, hat vollen Zugriff auf den Workspace. Bitte nicht in öffentlichen
            Kanälen teilen.
          </p>
        </section>

        <section className="card-pad">
          <h3 className="h-card">Statistik</h3>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 text-sm sm:grid-cols-3">
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

        <section className="card-pad">
          <h3 className="h-card">Aktive Nutzer ({workspace.active_users.length})</h3>
          <p className="mt-3 alert-info">
            ⓘ Diese Liste zeigt alle Personen, die mindestens eine Bestellung eingetragen oder eine
            Sammelbestellung gestartet haben. Die Liste basiert auf Aktivität, nicht auf
            Mitgliedschaft. Personen mit gleichem Namen erscheinen als ein Eintrag.
          </p>
          {workspace.active_users.length === 0 ? (
            <p className="mt-4 help">Noch keine Aktivität.</p>
          ) : (
            <ul className="mt-4 divide-y divide-stone-200/70">
              {workspace.active_users.map((u) => (
                <li
                  key={u.name}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                >
                  <span className="font-medium text-stone-800">{u.name}</span>
                  <span className="text-stone-500">
                    {u.items_count} Items · zuletzt {formatRelativeTime(u.last_seen)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card-pad">
          <h3 className="h-card">Verwaltung</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setRenaming(true)}
              disabled={renaming}
              className="btn-secondary"
            >
              Name ändern
            </button>
            <button
              type="button"
              onClick={() => setDialog('rotate')}
              className="btn-warn-soft"
            >
              Token rotieren
            </button>
            <button
              type="button"
              onClick={() => setDialog('delete')}
              className="btn-danger-soft"
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
              Der bisherige Link funktioniert nach Bestätigung nicht mehr. Alle Nutzer brauchen
              anschließend den neuen Link. Diese Aktion kann nicht rückgängig gemacht werden.
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
              Alle Daten dieses Workspaces werden unwiderruflich gelöscht: Sessions, Items,
              Restaurants, Speisekarten. Diese Aktion kann nicht rückgängig gemacht werden.
            </>
          }
          requireText={workspace.name}
          confirmLabel="Endgültig löschen"
          destructive={true}
          busy={busy}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDialog(null)}
        />
      </main>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs font-medium uppercase tracking-wider text-stone-500">{label}</dt>
      <dd className="mt-1 text-base font-semibold text-stone-900">{value}</dd>
    </div>
  )
}

function WorkspaceDetailSkeleton() {
  return (
    <div className="space-y-6" aria-label="Workspace wird geladen">
      <div className="card-pad">
        <div className="h-3 w-24 animate-pulse rounded bg-stone-200" />
        <div className="mt-3 h-9 w-full animate-pulse rounded bg-stone-100" />
      </div>
      <div className="card-pad">
        <div className="h-3 w-20 animate-pulse rounded bg-stone-200" />
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-20 animate-pulse rounded bg-stone-100" />
              <div className="h-5 w-16 animate-pulse rounded bg-stone-200" />
            </div>
          ))}
        </div>
      </div>
      <div className="card-pad">
        <div className="h-3 w-32 animate-pulse rounded bg-stone-200" />
        <ul className="mt-4 space-y-3">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center justify-between">
              <div className="h-4 w-1/3 animate-pulse rounded bg-stone-100" />
              <div className="h-3 w-1/4 animate-pulse rounded bg-stone-100" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
