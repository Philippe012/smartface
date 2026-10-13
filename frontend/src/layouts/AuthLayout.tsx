import { LockKeyhole, Network, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { FaceScan } from '../components/FaceScan'
import { Logo } from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'
import { useDocumentTitle } from '../hooks/useApi'

export function AuthLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  useDocumentTitle(title)
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="on-dark relative isolate hidden flex-col justify-between overflow-hidden bg-ink-950 p-10 text-white lg:flex">
        <div className="bg-grid absolute inset-0 -z-10 opacity-70 mask-[radial-gradient(ellipse_at_center,black_20%,transparent_75%)]" aria-hidden />
        <div className="absolute top-1/3 left-1/2 -z-10 size-[30rem] -translate-x-1/2 rounded-full bg-linear-to-tr from-cyan-500/25 to-emerald-400/15 blur-3xl" aria-hidden />
        <Link to="/" className="relative w-fit" aria-label="SmartFace home">
          <Logo inverted />
        </Link>
        <div className="relative mx-auto w-full max-w-sm py-8">
          <FaceScan compact />
        </div>
        <ul className="relative flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/70">
          {[
            { icon: Network, label: 'Local network only' },
            { icon: LockKeyhole, label: 'Encrypted templates' },
            { icon: ShieldCheck, label: 'Fully audited' },
          ].map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2">
              <Icon size={16} className="text-[#2af5a0]" aria-hidden />
              {label}
            </li>
          ))}
        </ul>
      </aside>

      <main className="relative flex flex-col px-4 py-6 sm:px-8">
        <div className="flex items-center justify-between lg:justify-end">
          <Link to="/" className="lg:hidden" aria-label="SmartFace home">
            <Logo />
          </Link>
          <ThemeToggle />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 animate-page-in flex-col justify-center py-10">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {description && <p className="mt-2 text-sm text-slate-500">{description}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 text-sm text-slate-500">{footer}</div>}
        </div>
        <p className="text-center text-xs text-slate-400">Authorized personnel only. Sign-in activity is logged.</p>
      </main>
    </div>
  )
}
