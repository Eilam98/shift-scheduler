const TOKEN_KEY = 'shift-organizer.token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  status: number
  code?: string // stable id for errors the UI translates (see errorMessage in i18n)
  params?: Record<string, string>

  constructor(status: number, message: string, code?: string, params?: Record<string, string>) {
    super(message)
    this.status = status
    this.code = code
    this.params = params
  }
}

/**
 * Calls the Express API (proxied to /api by Vite in dev). Sends the stored
 * JWT as a Bearer token, JSON-encodes the body, and throws ApiError with
 * the server's `error` message (and `code`, if any) on any non-2xx response.
 */
export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
): Promise<T> {
  const headers: Record<string, string> = { ...options.headers }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError(res.status, data.error ?? 'Something went wrong', data.code, data.params)
  }
  return data as T
}
