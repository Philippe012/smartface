import clsx from 'clsx'
import type { ReactNode } from 'react'

import { useDocumentTitle } from '../hooks/useApi'

/** Dashboard welcome banner with the logo under a sweeping scan line. */
export function ScanBanner({
  title,
  subtitle,
  status,
  live,
  actions,
  documentTitle,
}: {
  title: ReactNode
  subtitle?: ReactNode
  status: ReactNode
  /** Animate the scan and show a green dot; pass true only for a genuinely good state. */
  live: boolean
  actions?: ReactNode
  documentTitle: string
}) {
  useDocumentTitle(documentTitle)
  return (
    <section className="on-dark relative isolate mb-6 overflow-hidden rounded-2xl bg-ink-950 px-5 py-6 text-white shadow-xl shadow-ink-950/10 ring-1 ring-white/5 sm:px-7">
      <div className="bg-grid absolute inset-0 -z-10 opacity-50 mask-[linear-gradient(to_left,black,transparent_70%)]" aria-hidden />
      <div className="absolute -top-24 -right-16 -z-10 size-72 rounded-full bg-linear-to-tr from-cyan-500/30 to-emerald-400/20 blur-3xl" aria-hidden />
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-2xl ring-1 ring-white/10">
          <img src="/brand/logo-192.png" alt="" width={64} height={64} className="size-full" />
          {live && (
            <span
              className="absolute inset-x-0 top-0 h-1/3 animate-scan bg-linear-to-b from-transparent to-[#19e3f0]/50 [--scan-distance:200%]"
              aria-hidden
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-white/60">{subtitle}</p>}
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/85">
            <span className="relative flex size-2">
              {live && <span className="absolute inset-0 animate-ping rounded-full bg-[#2af5a0]" />}
              <span className={clsx('relative size-2 rounded-full', live ? 'bg-[#2af5a0]' : 'bg-amber-400')} />
            </span>
            {status}
          </p>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </section>
  )
}
