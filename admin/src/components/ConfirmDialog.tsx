import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

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

  // Lock body scroll while the dialog is mounted so the page behind doesn't
  // shift around when the dialog is taller than the viewport.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  if (!open) return null

  const canConfirm = !busy && (!requireText || typed === requireText)

  // Render through a portal so the dialog escapes any ancestor with
  // `backdrop-filter` (e.g. the sticky app-header), which would otherwise
  // become the containing block for `position: fixed` and clip the modal.
  return createPortal(
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div
        className="flex min-h-full items-center justify-center p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget && !busy) onCancel()
        }}
      >
      <div className="w-full max-w-md card p-6 shadow-pop animate-fade-in-up">
        <h2 id="confirm-title" className="text-lg font-semibold text-stone-900">
          {title}
        </h2>
        {description ? <div className="mt-3 text-sm text-stone-600">{description}</div> : null}

        {requireText ? (
          <div className="mt-4">
            <label htmlFor="confirm-require-input" className="label">
              Zur Bestätigung „{requireText}" eingeben
            </label>
            <input
              id="confirm-require-input"
              ref={inputRef}
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="input"
            />
          </div>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="btn-secondary"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className={destructive ? 'btn-danger' : 'btn-primary'}
          >
            {busy ? 'Bitte warten…' : confirmLabel}
          </button>
        </div>
      </div>
      </div>
    </div>,
    document.body,
  )
}
