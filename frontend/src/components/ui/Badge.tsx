import clsx from 'clsx'
import type { ReactNode } from 'react'

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand'

const tones: Record<Tone, { box: string; dot: string }> = {
  neutral: { box: 'bg-slate-100 text-slate-700 ring-slate-200', dot: 'bg-slate-400' },
  success: { box: 'bg-emerald-50 text-emerald-800 ring-emerald-200', dot: 'bg-emerald-500' },
  warning: { box: 'bg-amber-50 text-amber-800 ring-amber-200', dot: 'bg-amber-500' },
  danger: { box: 'bg-red-50 text-red-700 ring-red-200', dot: 'bg-red-500' },
  info: { box: 'bg-sky-50 text-sky-800 ring-sky-200', dot: 'bg-sky-500' },
  brand: { box: 'bg-brand-50 text-brand-800 ring-brand-200', dot: 'bg-brand-600' },
}

export function Badge({
  tone = 'neutral',
  dot = false,
  children,
  className,
}: {
  tone?: Tone
  dot?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
        tones[tone].box,
        className,
      )}
    >
      {dot && <span className={clsx('size-1.5 rounded-full', tones[tone].dot)} aria-hidden />}
      {children}
    </span>
  )
}
