import { CalendarDays, ClipboardList, LayoutDashboard, Settings, ShieldCheck, UserRound } from 'lucide-react'

import { AppShell, type NavGroup } from './AppShell'

const groups: NavGroup[] = [
  {
    items: [
      { to: '/employee/dashboard', label: 'Overview', icon: LayoutDashboard },
      { to: '/employee/attendance', label: 'My attendance', icon: CalendarDays },
      { to: '/employee/correction-requests', label: 'Corrections', icon: ClipboardList },
    ],
  },
  {
    label: 'Account',
    items: [
      { to: '/employee/profile', label: 'Profile', icon: UserRound },
      { to: '/employee/settings', label: 'Settings', icon: Settings },
      { to: '/employee/security', label: 'Security', icon: ShieldCheck },
    ],
  },
]

export function EmployeeLayout() {
  return (
    <AppShell
      groups={groups}
      settingsPath="/employee/settings"
      securityPath="/employee/security"
      areaLabel="Employee portal"
    />
  )
}
