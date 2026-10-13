import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { api } from '../../lib/api'
import {
  applyTheme,
  isThemePreference,
  readStoredTheme,
  resolveTheme,
  storeTheme,
  watchSystemTheme,
  type ResolvedTheme,
  type ThemePreference,
} from '../../lib/theme'
import type { CurrentUser } from '../../types/api'
import { useAuth } from '../auth/AuthContext'

interface ThemeState {
  preference: ThemePreference
  resolved: ResolvedTheme
  setPreference: (pref: ThemePreference) => Promise<void>
  /** Flip between light and dark (saved as an explicit choice). */
  toggle: () => void
}

const ThemeContext = createContext<ThemeState | null>(null)

/**
 * App-wide theme. The choice is kept in localStorage (so the landing and sign-in
 * pages remember it) and, for signed-in users, on their account so it follows them.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, setUser } = useAuth()
  const [preference, setPref] = useState<ThemePreference>(readStoredTheme)
  const [systemDark, setSystemDark] = useState(() => resolveTheme('system') === 'dark')
  const firstApply = useRef(true)

  useEffect(() => watchSystemTheme(setSystemDark), [])

  // When someone signs in, their saved account preference wins over this browser's.
  const userId = user?.id
  const serverPref = user?.theme_preference
  useEffect(() => {
    if (userId !== undefined && isThemePreference(serverPref)) {
      setPref(serverPref)
      storeTheme(serverPref)
    }
  }, [userId, serverPref])

  const resolved = resolveTheme(preference, systemDark)
  useEffect(() => {
    applyTheme(resolved, !firstApply.current)
    firstApply.current = false
  }, [resolved])

  const setPreference = useCallback(
    async (pref: ThemePreference) => {
      setPref(pref)
      storeTheme(pref)
      if (user && user.theme_preference !== pref) {
        try {
          setUser(await api<CurrentUser>('/auth/me', { method: 'PATCH', body: { theme_preference: pref } }))
        } catch {
          // Still applied locally; it will sync the next time the account is saved.
        }
      }
    },
    [user, setUser],
  )

  const toggle = useCallback(() => void setPreference(resolved === 'dark' ? 'light' : 'dark'), [resolved, setPreference])

  const value = useMemo(() => ({ preference, resolved, setPreference, toggle }), [preference, resolved, setPreference, toggle])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

// eslint-disable-next-line react/only-export-components
export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
