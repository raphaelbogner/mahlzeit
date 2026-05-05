import { useEffect, useRef, useState } from 'react'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: React.ReactNode
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  // If set, the user must type this string verbatim before the confirm button enables.
  requireText?: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Abbrechen',
  destructive = false,
  requireText,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('')
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) {
      setTyped('')
      return
    }
    // Move focus into the dialog: input if required, otherwise the cancel
    // button (safer default for destructive dialogs).
    if (requireText && inputRef.current) {
      inputRef.current.focus()
    } else if (cancelButtonRef.current) {
      cancelButtonRef.current.focus()
    }
  }, [open, requireText])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape' && !busy) {
        e.preventDefault()
        onCancel()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onCancel])

  if (!open) return null

  const canConfirm = !busy && (!requireText || typed === requireText)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel()
      }}
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-neutral-900">
        <h2 id="confirm-title" className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          {title}
        </h2>
        {description ? (
          <div className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">{description}</div>
        ) : null}

        {requireText ? (
          <div className="mt-4">
            <label htmlFor="confirm-require-input" className="block text-sm font-medium text-neutral-700 dark:text-neutral-200">
              Zur Bestätigung „{requireText}" eingeben
            </label>
            <input
              id="confirm-require-input"
              ref={inputRef}
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-violet-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
            />
          </div>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className={
              'rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ' +
              (destructive
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-violet-600 hover:bg-violet-700')
            }
          >
            {busy ? 'Bitte warten…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
