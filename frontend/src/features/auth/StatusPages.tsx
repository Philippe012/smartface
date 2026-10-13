import { Compass, ShieldAlert } from 'lucide-react'
import type { ComponentType } from 'react'

import { Logo } from '../../components/Logo'
import { ThemeToggle } from '../../components/ThemeToggle'
import { ButtonLink } from '../../components/ui/Button'
import { useDocumentTitle } from '../../hooks/useApi'
import { homeFor, useAuth } from './AuthContext'

function StatusPage({
  icon: Icon,
  code,
  title,
  text,
}: {
  icon: ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>
  code: string
  title: string
  text: string
}) {
  useDocumentTitle(title)
  const { user } = useAuth()
  return (
    <div className="flex min-h-dvh flex-col px-4 py-8 sm:px-8">
      <div className="flex items-center justify-between">
        <Logo />
        <ThemeToggle />
      </div>
      <main className="flex flex-1 items-center justify-center">
        <div className="max-w-md animate-page-in text-center">
          <span className="relative mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-200">
            <span className="absolute inset-0 animate-pulse-ring rounded-2xl border border-brand-400/50" aria-hidden />
            <Icon size={24} aria-hidden />
          </span>
          <p className="mt-5 text-sm font-semibold text-brand-700">{code}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-3 text-sm text-slate-600">{text}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            {user ? (
              <ButtonLink to={homeFor(user.role)}>Go to your dashboard</ButtonLink>
            ) : (
              <ButtonLink to="/login">Sign in</ButtonLink>
            )}
            <ButtonLink to="/" variant="secondary">
              Home page
            </ButtonLink>
          </div>
        </div>
      </main>
    </div>
  )
}

export function UnauthorizedPage() {
  return (
    <StatusPage
      icon={ShieldAlert}
      code="403"
      title="You don't have access to this page"
      text="Your account role does not include this area. If you believe you need access, contact a SmartFace administrator."
    />
  )
}

export function NotFoundPage() {
  return (
    <StatusPage
      icon={Compass}
      code="404"
      title="Page not found"
      text="The page you are looking for does not exist or has moved."
    />
  )
}
