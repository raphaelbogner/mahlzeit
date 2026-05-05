import { useState } from 'react'
import { createWorkspace } from '../api/workspaces'
import type { WorkspaceDetail } from '../api/workspaces'
import { ApiError } from '../api/client'
import { CopyButton } from './CopyButton'
import { useToast } from './Toast'

export interface CreateWorkspaceFormProps {
  onCreated: (workspace: WorkspaceDetail) => void
  onClose: () => void
}

export function CreateWorkspaceForm({ onCreated, onClose }: CreateWorkspaceFormProps) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<WorkspaceDetail | null>(null)
  const { showError } = useToast()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const ws = await createWorkspace(name.trim())
      setCreated(ws)
      onCreated(ws)
    } catch (err) {
      showError(err instanceof ApiError ? err.message : 'Anlegen fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  if (created) {
    return (
      <div className="alert-success animate-fade-in-up">
        <h3 className="text-base font-semibold text-emerald-900">
          Workspace „{created.name}" angelegt
        </h3>
        <p className="mt-2 text-sm text-emerald-800">
          Diesen Link an die Workspace-Mitglieder weitergeben. Der Link ist die
          einzige Möglichkeit zum Zugriff — bitte gut aufbewahren.
        </p>
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-white p-2 ring-1 ring-emerald-200">
          <code className="flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs text-stone-800">
            {created.url}
          </code>
          <CopyButton value={created.url} label="Link kopieren" />
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">
            Schließen
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="card-pad animate-fade-in-up">
      <h3 className="h-section">Neuen Workspace anlegen</h3>
      <div className="mt-3">
        <label htmlFor="ws-name" className="label">
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
          className="input"
        />
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} disabled={busy} className="btn-secondary">
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={busy || name.trim().length === 0}
          className="btn-primary"
        >
          {busy ? 'Lege an…' : 'Anlegen'}
        </button>
      </div>
    </form>
  )
}
