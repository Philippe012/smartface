/**
 * Minimal API client for the Django REST backend.
 * Session cookie authentication with CSRF protection; no tokens are stored in the browser.
 */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '')

export type FieldErrors = Record<string, string[]>
export type Query = Record<string, string | number | boolean | null | undefined>

export class ApiError extends Error {
  status: number
  fieldErrors: FieldErrors

  constructor(status: number, message: string, fieldErrors: FieldErrors = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }

  get isNetworkError() {
    return this.status === 0
  }
}

let csrfToken: string | null = null
let unauthenticatedHandler: (() => void) | null = null

/** Called when the server reports that the session is missing or expired. */
export function onUnauthenticated(handler: (() => void) | null) {
  unauthenticatedHandler = handler
}

/** Django rotates the CSRF token on login/logout; forget the cached one. */
export function resetCsrf() {
  csrfToken = null
}

async function getCsrfToken(): Promise<string> {
  if (!csrfToken) {
    const res = await fetch(`${BASE_URL}/auth/csrf`, { credentials: 'include' })
    const data = (await res.json()) as { csrfToken: string }
    csrfToken = data.csrfToken
  }
  return csrfToken
}

export function withQuery(path: string, query?: Query): string {
  if (!query) return path
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${path}${path.includes('?') ? '&' : '?'}${qs}` : path
}

function normaliseErrors(errors: unknown): FieldErrors {
  if (!errors || typeof errors !== 'object') return {}
  const out: FieldErrors = {}
  for (const [key, value] of Object.entries(errors as Record<string, unknown>)) {
    out[key] = Array.isArray(value) ? value.map(String) : [String(value)]
  }
  return out
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  query?: Query
  signal?: AbortSignal
}

async function send(path: string, options: RequestOptions, retry = true): Promise<Response> {
  const method = options.method ?? 'GET'
  const headers: Record<string, string> = { Accept: 'application/json' }
  let body: BodyInit | undefined
  if (options.body instanceof FormData) {
    body = options.body
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(options.body)
  }
  if (method !== 'GET') headers['X-CSRFToken'] = await getCsrfToken()

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${withQuery(path, options.query)}`, {
      method,
      headers,
      body,
      credentials: 'include',
      signal: options.signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new ApiError(0, 'Cannot reach the SmartFace server. Check your network connection.')
  }

  if (res.status === 403 && method !== 'GET' && retry) {
    const text = await res.clone().text()
    if (text.includes('CSRF')) {
      resetCsrf()
      return send(path, options, false)
    }
  }
  return res
}

async function toError(res: Response): Promise<ApiError> {
  let detail = `Request failed (${res.status}).`
  let fieldErrors: FieldErrors = {}
  try {
    const data = await res.json()
    if (data?.detail) detail = String(data.detail)
    fieldErrors = normaliseErrors(data?.errors)
  } catch {
    if (res.status >= 500) detail = 'The server encountered an error. Please try again.'
  }
  if (res.status === 403 && /credentials were not provided|not authenticated/i.test(detail)) {
    unauthenticatedHandler?.()
    detail = 'Your session has ended. Please sign in again.'
  }
  return new ApiError(res.status, detail, fieldErrors)
}

export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await send(path, options)
  if (!res.ok) throw await toError(res)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

/** Download a server-generated file (CSV exports) using the session cookie. */
export async function downloadFile(path: string, query?: Query, fallbackName = 'export.csv') {
  const res = await send(withQuery(path, query), {})
  if (!res.ok) throw await toError(res)
  const blob = await res.blob()
  const disposition = res.headers.get('Content-Disposition') ?? ''
  const name = /filename="?([^"]+)"?/.exec(disposition)?.[1] ?? fallbackName
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return 'Something went wrong.'
}
