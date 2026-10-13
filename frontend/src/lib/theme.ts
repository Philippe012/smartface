export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

/** Must match the key read by the boot script in index.html. */
export const THEME_STORAGE_KEY = 'smartface-theme'

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark'
}

export function readStoredTheme(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    return isThemePreference(value) ? value : 'system'
  } catch {
    return 'system'
  }
}

export function storeTheme(pref: ThemePreference) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref)
  } catch {
    // Private mode or blocked storage: the theme still applies for this visit.
  }
}

export function resolveTheme(pref: ThemePreference, systemDark = darkQuery().matches): ResolvedTheme {
  return pref === 'system' ? (systemDark ? 'dark' : 'light') : pref
}

/** Toggle the root class, cross-fading where the browser supports View Transitions. */
export function applyTheme(theme: ResolvedTheme, animate = false) {
  const root = document.documentElement
  if (root.classList.contains('dark') === (theme === 'dark')) return
  const swap = () => {
    root.classList.toggle('dark', theme === 'dark')
    root.style.colorScheme = theme
  }
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (animate && !reduced && 'startViewTransition' in document) document.startViewTransition(swap)
  else swap()
}

export function watchSystemTheme(onChange: (dark: boolean) => void): () => void {
  const query = darkQuery()
  const listener = (e: MediaQueryListEvent) => onChange(e.matches)
  query.addEventListener('change', listener)
  return () => query.removeEventListener('change', listener)
}
