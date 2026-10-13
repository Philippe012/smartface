import clsx from 'clsx'
import { CircleAlert, CircleCheck, X } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type ToastTone = 'success' | 'error'
interface ToastItem {
  id: number
  tone: ToastTone
  message: string
}

interface ToastApi {
  success: (message: string) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), [])
  const push = useCallback(
    (tone: ToastTone, message: string) => {
      const id = Date.now() + Math.random()
      setItems((list) => [...list.slice(-3), { id, tone, message }])
      window.setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4000)
    },
    [dismiss],
  )
  const value = useMemo<ToastApi>(
    () => ({ success: (m) => push('success', m), error: (m) => push('error', m) }),
    [push],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={clsx(
              'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border bg-surface px-4 py-3 text-sm shadow-lg',
              t.tone === 'success' ? 'border-emerald-200' : 'border-red-200',
            )}
          >
            {t.tone === 'success' ? (
              <CircleCheck size={18} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden />
            ) : (
              <CircleAlert size={18} className="mt-0.5 shrink-0 text-red-600" aria-hidden />
            )}
            <p className="flex-1 text-slate-800">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="rounded p-0.5 text-slate-400 hover:text-slate-700"
              aria-label="Dismiss notification"
            >
              <X size={16} aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
