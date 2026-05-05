import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

type ToastKind = 'error' | 'info' | 'success'

interface Toast {
  id: number
  kind: ToastKind
  message: string
}

interface ToastContextValue {
  showError: (message: string) => void
  showInfo: (message: string) => void
  showSuccess: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((kind: ToastKind, message: string): void => {
    const id = Date.now() + Math.random()
    setToasts((current) => [...current, { id, kind, message }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  const value = useMemo<ToastContextValue>(
    () => ({
      showError: (m) => push('error', m),
      showInfo: (m) => push('info', m),
      showSuccess: (m) => push('success', m),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={
              'pointer-events-auto w-full max-w-md rounded px-4 py-2 text-sm shadow-lg ' +
              (t.kind === 'error'
                ? 'bg-red-600 text-white'
                : t.kind === 'success'
                  ? 'bg-green-600 text-white'
                  : 'bg-neutral-800 text-white')
            }
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

// Hook that observes an error and shows a toast for it once when it changes.
export function useErrorToast(error: { message: string } | string | null): void {
  const { showError } = useToast()
  useEffect(() => {
    if (error) showError(typeof error === 'string' ? error : error.message)
  }, [error, showError])
}
