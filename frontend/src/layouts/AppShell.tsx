import clsx from 'clsx'
import { ChevronDown, LogOut, Menu, Settings, ShieldCheck, WifiOff, X } from 'lucide-react'
import { useEffect, useRef, useState, type ComponentType } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'

import { Logo } from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'
import { useOnlineStatus } from '../hooks/useApi'
import { initials } from '../lib/format'
import { useAuth } from '../features/auth/AuthContext'

export interface NavItem {
  to: string
  label: string
  icon: ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>
  badge?: number
  end?: boolean
}

export interface NavGroup {
  label?: string
  items: NavItem[]
}

function NavList({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-6">
      {groups.map((group, i) => (
        <div key={group.label ?? i}>
          {group.label && (
            <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">{group.label}</p>
          )}
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    clsx(
                      'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'bg-brand-50 text-brand-800 before:absolute before:inset-y-1.5 before:-left-3 before:w-1 before:rounded-r-full before:bg-linear-to-b before:from-cyan-400 before:to-emerald-400'
                        : 'text-slate-600 hover:translate-x-0.5 hover:bg-slate-100 hover:text-slate-900',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon size={18} className={clsx('transition-colors', isActive ? 'text-brand-700' : 'text-slate-400 group-hover:text-slate-600')} aria-hidden />
                      <span className="flex-1">{item.label}</span>
                      {!!item.badge && (
                        <span className="tabular rounded-full bg-amber-100 px-1.5 py-px text-[11px] font-semibold text-amber-800">
                          {item.badge}
                          <span className="sr-only"> pending</span>
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function AccountMenu({ settingsPath, securityPath }: { settingsPath: string; securityPath: string }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!user) return null
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username
  const roleLabel = { admin: 'Administrator', operator: 'Operator', employee: 'Employee' }[user.role]

  const signOut = async () => {
    setOpen(false)
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2.5 rounded-full py-1 pr-2 pl-1 transition-colors hover:bg-slate-100"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-linear-to-br from-cyan-400 to-emerald-400 text-xs font-bold text-ink-950 ring-2 ring-surface">
          {initials(name)}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block max-w-40 truncate text-sm font-medium text-slate-900">{name}</span>
          <span className="block text-xs text-slate-500">{roleLabel}</span>
        </span>
        <ChevronDown size={16} className="text-slate-400" aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-60 origin-top-right animate-page-in overflow-hidden rounded-xl border border-slate-200 bg-surface py-1 shadow-xl"
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate text-sm font-medium text-slate-900">{name}</p>
            <p className="truncate text-xs text-slate-500">{user.email || user.username}</p>
          </div>
          <Link role="menuitem" to={settingsPath} onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
            <Settings size={16} className="text-slate-400" aria-hidden />
            Account settings
          </Link>
          <Link role="menuitem" to={securityPath} onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
            <ShieldCheck size={16} className="text-slate-400" aria-hidden />
            Password & security
          </Link>
          <button role="menuitem" type="button" onClick={signOut} className="flex w-full items-center gap-2.5 border-t border-slate-100 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
            <LogOut size={16} className="text-slate-400" aria-hidden />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

export function AppShell({
  groups,
  settingsPath,
  securityPath,
  areaLabel,
}: {
  groups: NavGroup[]
  settingsPath: string
  securityPath: string
  areaLabel: string
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const online = useOnlineStatus()
  const location = useLocation()

  useEffect(() => setMobileOpen(false), [location.pathname])
  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMobileOpen(false)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  const sidebar = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center px-5">
        <Link to="/" aria-label="SmartFace home">
          <Logo />
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <NavList groups={groups} onNavigate={onNavigate} />
      </div>
      <div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-400">{areaLabel}</div>
    </div>
  )

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only z-50 rounded bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-surface lg:block">
        {sidebar()}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] animate-page-in bg-surface shadow-2xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-3 rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
              aria-label="Close navigation"
            >
              <X size={18} aria-hidden />
            </button>
            {sidebar(() => setMobileOpen(false))}
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-surface/75 px-4 backdrop-blur-xl sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="-ml-1 rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Open navigation"
          >
            <Menu size={20} aria-hidden />
          </button>
          <Link to="/" className="lg:hidden" aria-label="SmartFace home">
            <Logo />
          </Link>
          <div className="flex-1" />
          <ThemeToggle />
          <AccountMenu settingsPath={settingsPath} securityPath={securityPath} />
        </header>

        {!online && (
          <div role="status" className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 sm:px-6">
            <WifiOff size={16} aria-hidden />
            You are offline. Data shown may be out of date until the connection to the local server returns.
          </div>
        )}

        <main id="main" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div key={location.pathname} className="animate-page-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
