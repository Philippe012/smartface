import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'

import { LoadingBlock } from '../../components/ui/Feedback'
import type { Role } from '../../types/api'
import { useAuth } from './AuthContext'

/**
 * Client-side route guard for navigation only. Every API endpoint enforces
 * the same permissions on the server.
 */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, checking } = useAuth()
  const location = useLocation()

  if (checking) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <LoadingBlock label="Checking your session" />
      </div>
    )
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  if (!roles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />
  }
  return <>{children}</>
}
