import { useEffect, useState } from 'react'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

type Options = { method?: string; json?: unknown; form?: FormData }

/** Calls the API under /api. Throws ApiError with a user-facing message on any failure. */
export async function request<T>(path: string, { method, json, form }: Options = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      method: method ?? (json !== undefined || form ? 'POST' : 'GET'),
      headers: json !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: json !== undefined ? JSON.stringify(json) : form,
    })
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.")
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const detail = body?.detail
    const message =
      typeof detail === 'string' ? detail
        : Array.isArray(detail) && typeof detail[0]?.msg === 'string' ? detail[0].msg
          : response.status >= 500 ? "Can't reach the server. Try again in a moment."
            : 'Something went wrong. Try again.'
    throw new ApiError(response.status, message)
  }
  return response.status === 204 ? (undefined as T) : response.json()
}

const POLL_MS = 3000

/**
 * GETs `path`, and keeps re-fetching every few seconds while `keepPolling(data)` is true.
 * Pass a module-level `keepPolling` so its identity is stable; a new function each render restarts polling.
 */
export function usePolled<T>(path: string, keepPolling: (data: T) => boolean) {
  const [state, setState] = useState<{ path: string; data?: T; error?: ApiError }>({ path })
  const [reloads, setReloads] = useState(0)

  useEffect(() => {
    let cancelled = false
    let timer: number | undefined
    async function load() {
      try {
        const data = await request<T>(path)
        if (cancelled) return
        setState({ path, data })
        if (keepPolling(data)) timer = window.setTimeout(load, POLL_MS)
      } catch (error) {
        if (!cancelled) setState({ path, error: error as ApiError })
      }
    }
    load()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [path, reloads, keepPolling])

  // Ignore results for a previous path while the new one loads.
  const current = state.path === path ? state : { path }
  return { data: current.data, error: current.error, reload: () => setReloads((n) => n + 1) }
}
