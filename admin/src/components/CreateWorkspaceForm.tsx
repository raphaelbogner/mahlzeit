import { useState } from 'react'
import { createWorkspace } from '../api/workspaces'
import type { WorkspaceDetail } from '../api/workspaces'
import { ApiError } from '../api/client'
import { CopyButton } from './CopyButton'

export interface CreateWorkspaceFormProps {
  onCreated: (workspace: WorkspaceDetail) => void
  onClose: () => void
}

export function CreateWorkspaceForm({ onCreated, onClose }: CreateWorkspaceFormProps) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<WorkspaceDetail | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const ws = await createWorkspace(name.trim())
      setCreated(ws)
      onCreated(ws)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Anlegen fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  if (created) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-5 dark:border-green-900 dark:bg-green-950/40">
        <h3 className="text-base font-semibold text-green-900 dark:text-green-200">
          Workspace „{created.name}" angelegt
        </h3>
        <p className="mt-2 text-sm text-green-800 dark:text-green-300">
          Diesen Link an die Workspace-Mitglieder weitergeben. Der Link ist die
          einzige Möglichkeit zum Zugriff — bitte gut aufbewahren.
        </p>
        <div className="mt-3 flex items-center gap-2 rounded border border-green-300 bg-white p-2 dark:border-green-800 dark:bg-neutral-900">
          <code className="flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs text-neutral-800 dark:text-neutral-200">
            {created.url}
          </code>
          <CopyButton value={created.url} label="Link kopieren" />
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200"
          >
            Schließen
          </button>
        </div>
      </div>
    )
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
        Neuen Workspace anlegen
      </h3>
      <div className="mt-3">
        <label htmlFor="ws-name" className="block text-sm font-medium text-neutral-700 dark:text-neutral-200">
          Name
        </label>
        <input
          id="ws-name"
          type="text"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          required
          placeholder="z. B. Acme GmbH"
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-violet-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
        />
      </div>
      {error ? (
        <div className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      ) : null}
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={busy || name.trim().length === 0}
          className="rounded bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {busy ? 'Lege an…' : 'Anlegen'}
        </button>
      </div>
    </form>
  )
}
