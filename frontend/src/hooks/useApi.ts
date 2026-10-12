import { useCallback, useEffect, useState } from 'react'

import { api, ApiError } from '../lib/api'

interface State<T> {
  data: T | undefined
  error: ApiError | null
  loading: boolean
}

/**
 * Fetch JSON from the API. Pass `null` to skip. Re-fetches when `path` changes.
 * `refreshMs` enables polling (paused while the tab is hidden).
 */
export function useApi<T>(path: string | null, options: { refreshMs?: number } = {}) {
  const [state, setState] = useState<State<T>>({ data: undefined, error: null, loading: path !== null })
  const [tick, setTick] = useState(0)

  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (path === null) return
    const controller = new AbortController()
    setState((s) => ({ ...s, loading: true }))
    api<T>(path, { signal: controller.signal })
      .then((data) => {
        setState({ data, error: null, loading: false })
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        const error = err instanceof ApiError ? err : new ApiError(0, String(err))
        setState((s) => ({ data: s.data, error, loading: false }))
      })
    return () => controller.abort()
  }, [path, tick])

  useEffect(() => {
    if (!options.refreshMs || path === null) return
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') reload()
    }, options.refreshMs)
    return () => window.clearInterval(id)
  }, [options.refreshMs, path, reload])

  return { ...state, reload, setData: (data: T) => setState((s) => ({ ...s, data })) }
}

/** Debounce a fast-changing value (search boxes). */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(id)
  }, [value, delay])
  return debounced
}

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · SmartFace` : 'SmartFace Attendance'
  }, [title])
}
