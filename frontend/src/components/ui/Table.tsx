import clsx from 'clsx'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react'

/** Horizontally scrollable table container; the page itself never scrolls sideways. */
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('w-full overflow-x-auto', className)}>
      <table className="w-full min-w-full border-collapse text-left text-sm">{children}</table>
    </div>
  )
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium tracking-wide text-slate-500 uppercase">
      {children}
    </thead>
  )
}

export function Th({ className, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th scope="col" className={clsx('px-4 py-2.5 font-medium whitespace-nowrap first:pl-4 sm:first:pl-5', className)} {...rest} />
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-slate-100">{children}</tbody>
}

export function Tr({ className, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={clsx('hover:bg-slate-50/60', className)} {...rest} />
}

export function Td({ className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={clsx('px-4 py-3 align-middle text-slate-700 first:pl-4 sm:first:pl-5', className)} {...rest} />
}

export function Pagination({
  page,
  pageSize,
  count,
  onPage,
}: {
  page: number
  pageSize: number
  count: number
  onPage: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(count / pageSize))
  if (count === 0) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, count)
  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 sm:px-5"
    >
      <p className="tabular">
        <span className="font-medium text-slate-900">{from}</span>–<span className="font-medium text-slate-900">{to}</span> of{' '}
        <span className="font-medium text-slate-900">{count}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 font-medium hover:bg-slate-50 disabled:opacity-50"
        >
          <ChevronLeft size={15} aria-hidden />
          <span className="hidden sm:inline">Previous</span>
        </button>
        <span className="tabular px-2 text-slate-500">
          {page} / {pages}
        </span>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= pages}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 font-medium hover:bg-slate-50 disabled:opacity-50"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight size={15} aria-hidden />
        </button>
      </div>
    </nav>
  )
}
