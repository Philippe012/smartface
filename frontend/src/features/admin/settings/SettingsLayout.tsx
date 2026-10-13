import clsx from 'clsx'
import { Archive, CalendarClock, Cpu, Eraser, Lock, ShieldCheck, UserRound } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'

import { useAuth } from '../../auth/AuthContext'

export const SETTINGS_SECTIONS = [
  { to: 'account', label: 'Account', icon: UserRound, description: 'Profile, email and light/dark theme.', adminOnly: false },
  { to: 'security', label: 'Security', icon: Lock, description: 'Password, sessions and staff accounts.', adminOnly: false },
  { to: 'attendance', label: 'Attendance & recognition', icon: CalendarClock, description: 'Policy, schedule, thresholds and duplicate suppression.', adminOnly: true },
  { to: 'privacy', label: 'Privacy', icon: ShieldCheck, description: 'Privacy notice and the alternative attendance method.', adminOnly: true },
  { to: 'retention', label: 'Retention', icon: Eraser, description: 'How long records and templates are kept.', adminOnly: true },
  { to: 'backup', label: 'Backup', icon: Archive, description: 'Database backups and restore guidance.', adminOnly: true },
  { to: 'system', label: 'System', icon: Cpu, description: 'Service health, versions and configuration.', adminOnly: false },
]

export function SettingsLayout() {
  const { user } = useAuth()
  const sections = SETTINGS_SECTIONS.filter((s) => !s.adminOnly || user?.role === 'admin')
  return (
    <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label="Settings" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <ul className="flex gap-1 lg:flex-col">
          {sections.map((s) => (
            <li key={s.to}>
              <NavLink
                to={`/admin/settings/${s.to}`}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap',
                    isActive ? 'bg-surface text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-600 transition-colors hover:bg-surface/70 hover:text-slate-900',
                  )
                }
              >
                <s.icon size={16} className="text-slate-400" aria-hidden />
                {s.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  )
}
