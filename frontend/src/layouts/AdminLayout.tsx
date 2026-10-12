import {
  Camera,
  ClipboardCheck,
  FileBarChart,
  LayoutDashboard,
  ScrollText,
  Settings,
  Users,
  CalendarDays,
} from 'lucide-react'

import { useAuth } from '../features/auth/AuthContext'
import { useApi } from '../hooks/useApi'
import { AppShell, type NavGroup } from './AppShell'

export function AdminLayout() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const { data: counts } = useApi<{ pending_reviews: number; pending_corrections: number }>(
    '/attendance/review-counts',
    { refreshMs: 60_000 },
  )

  const groups: NavGroup[] = [
    {
      items: [
        { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/admin/attendance', label: 'Attendance', icon: CalendarDays },
        {
          to: '/admin/reviews',
          label: 'Reviews',
          icon: ClipboardCheck,
          badge: counts ? counts.pending_reviews + (isAdmin ? counts.pending_corrections : 0) : undefined,
        },
        { to: '/admin/reports', label: 'Reports', icon: FileBarChart },
      ],
    },
    {
      label: 'Manage',
      items: [
        { to: '/admin/employees', label: 'Employees', icon: Users },
        { to: '/admin/cameras', label: 'Cameras', icon: Camera },
        ...(isAdmin ? [{ to: '/admin/audit-logs', label: 'Audit log', icon: ScrollText }] : []),
        { to: '/admin/settings', label: 'Settings', icon: Settings },
      ],
    },
  ]

  return (
    <AppShell
      groups={groups}
      settingsPath="/admin/settings/account"
      securityPath="/admin/settings/security"
      areaLabel={isAdmin ? 'Administrator console' : 'Operator console'}
    />
  )
}
