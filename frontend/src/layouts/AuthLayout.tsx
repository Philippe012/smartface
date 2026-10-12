import { LockKeyhole, Network, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { Logo } from '../components/Logo'
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
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-ink-900 p-10 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
          aria-hidden
        />
        <Link to="/" className="relative" aria-label="SmartFace home">
          <Logo inverted />
        </Link>
        <div className="relative max-w-md">
          <h2 className="text-2xl font-semibold tracking-tight">Attendance you can trust and verify.</h2>
          <ul className="mt-8 space-y-4 text-sm text-slate-300">
            <li className="flex gap-3">
              <Network size={18} className="mt-0.5 shrink-0 text-brand-300" aria-hidden />
              Runs on your local network. No cloud recognition services.
            </li>
            <li className="flex gap-3">
              <LockKeyhole size={18} className="mt-0.5 shrink-0 text-brand-300" aria-hidden />
              Face templates are encrypted; photos are not stored.
            </li>
            <li className="flex gap-3">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-brand-300" aria-hidden />
              Every correction and privileged action is audited.
            </li>
          </ul>
        </div>
        <p className="relative text-xs text-slate-500">Authorized personnel only. Sign-in activity is logged.</p>
      </aside>

      <main className="flex flex-col px-4 py-8 sm:px-8">
        <Link to="/" className="mb-10 lg:hidden" aria-label="SmartFace home">
          <Logo />
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center pb-10">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {description && <p className="mt-2 text-sm text-slate-500">{description}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 text-sm text-slate-500">{footer}</div>}
        </div>
      </main>
    </div>
  )
}
