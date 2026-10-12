import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { api, ApiError, onUnauthenticated, resetCsrf } from '../../lib/api'
import type { CurrentUser, Role } from '../../types/api'

interface AuthState {
  user: CurrentUser | null
  /** True until the initial session check finishes. */
  checking: boolean
  /** Set when the server could not be reached during the session check. */
  connectionError: string | null
  login: (username: string, password: string) => Promise<CurrentUser>
  logout: () => Promise<void>
  refresh: () => Promise<void>
  setUser: (user: CurrentUser) => void
}

const AuthContext = createContext<AuthState | null>(null)

export function homeFor(role: Role): string {
  return role === 'employee' ? '/employee/dashboard' : '/admin/dashboard'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [checking, setChecking] = useState(true)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setUser(await api<CurrentUser>('/auth/me'))
      setConnectionError(null)
    } catch (err) {
      setUser(null)
      if (err instanceof ApiError && err.isNetworkError) setConnectionError(err.message)
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    onUnauthenticated(() => setUser(null))
    return () => onUnauthenticated(null)
  }, [refresh])

  const login = useCallback(async (username: string, password: string) => {
    const me = await api<CurrentUser>('/auth/session', { method: 'POST', body: { username, password } })
    resetCsrf()
    setUser(me)
    setConnectionError(null)
    return me
  }, [])

  const logout = useCallback(async () => {
    try {
      await api('/auth/session', { method: 'DELETE' })
    } finally {
      resetCsrf()
      setUser(null)
    }
  }, [])

  const value = useMemo(
    () => ({ user, checking, connectionError, login, logout, refresh, setUser }),
    [user, checking, connectionError, login, logout, refresh],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
