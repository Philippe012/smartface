import clsx from 'clsx'
import { CircleAlert, CircleCheck, Info, LoaderCircle, RefreshCw, TriangleAlert, WifiOff } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'

import { ApiError } from '../../lib/api'
import { Button } from './Button'

export function Spinner({ label = 'Loading', className }: { label?: string; className?: string }) {
  return (
    <span role="status" className={clsx('inline-flex items-center gap-2 text-sm text-slate-500', className)}>
      <LoaderCircle size={18} className="animate-spin" aria-hidden />
      <span>{label}</span>
    </span>
  )
}

export function LoadingBlock({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center py-10">
      <Spinner label={label} />
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={clsx('flex flex-col items-center px-6 py-12 text-center', className)}>
      {Icon && (
        <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <Icon size={20} aria-hidden />
        </span>
      )}
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const network = error instanceof ApiError && error.isNetworkError
  const message = error instanceof Error ? error.message : 'Something went wrong.'
  return (
    <EmptyState
      icon={network ? WifiOff : CircleAlert}
      title={network ? 'Server unreachable' : 'Could not load this data'}
      description={message}
      action={
        onRetry && (
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={onRetry}>
            Try again
          </Button>
        )
      }
    />
  )
}

const alertStyles = {
  info: { box: 'border-sky-200 bg-sky-50 text-sky-900', icon: Info, iconClass: 'text-sky-600' },
  success: { box: 'border-emerald-200 bg-emerald-50 text-emerald-900', icon: CircleCheck, iconClass: 'text-emerald-600' },
  warning: { box: 'border-amber-200 bg-amber-50 text-amber-900', icon: TriangleAlert, iconClass: 'text-amber-600' },
  danger: { box: 'border-red-200 bg-red-50 text-red-900', icon: CircleAlert, iconClass: 'text-red-600' },
}

export function Alert({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: keyof typeof alertStyles
  title?: ReactNode
  children?: ReactNode
  action?: ReactNode
  className?: string
}) {
  const style = alertStyles[tone]
  const Icon = style.icon
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={clsx('flex gap-3 rounded-lg border px-4 py-3 text-sm', style.box, className)}
    >
      <Icon size={18} className={clsx('mt-0.5 shrink-0', style.iconClass)} aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={clsx(title && 'mt-0.5', 'opacity-90')}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  )
}
