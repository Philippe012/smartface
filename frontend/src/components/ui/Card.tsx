import clsx from 'clsx'
import type { ComponentType, HTMLAttributes, ReactNode } from 'react'

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('rounded-lg border border-slate-200 bg-white shadow-xs', className)} {...rest} />
}

export function CardHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div
      className={clsx(
        'flex flex-col gap-3 border-b border-slate-200 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('px-4 py-4 sm:px-5', className)} {...rest} />
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>
  tone?: 'neutral' | 'brand' | 'warning'
}) {
  const iconTone = {
    neutral: 'bg-slate-100 text-slate-600',
    brand: 'bg-brand-50 text-brand-700',
    warning: 'bg-amber-50 text-amber-700',
  }[tone]
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="tabular mt-1.5 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
        </div>
        {Icon && (
          <span className={clsx('flex size-9 shrink-0 items-center justify-center rounded-md', iconTone)}>
            <Icon size={18} aria-hidden />
          </span>
        )}
      </div>
      {hint && <div className="mt-2 text-xs text-slate-500">{hint}</div>}
    </Card>
  )
}

/** Definition list used on detail pages. */
export function DetailList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-slate-100">
      {items.map((item) => (
        <div key={item.label} className="grid gap-1 py-2.5 sm:grid-cols-3 sm:gap-4">
          <dt className="text-sm text-slate-500">{item.label}</dt>
          <dd className="text-sm break-words text-slate-900 sm:col-span-2">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
