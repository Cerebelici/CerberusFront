import { env } from '../config/env'

export type ApiErrorKind = 'http' | 'network' | 'timeout' | 'invalid-response'

/** Every failure surfaced by apiRequest (except caller-initiated aborts) is an ApiError. */
export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number | null
  readonly body: unknown

  constructor(message: string, kind: ApiErrorKind, status: number | null = null, body: unknown = null) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
    this.body = body
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException || error instanceof Error) &&
    error.name === 'AbortError'
  )
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

export function buildApiUrl(path: string): string {
  return `${env.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

export interface ApiRequestOptions<T> {
  /** Validates/narrows the decoded JSON. Throw to reject the payload. */
  parse: (body: unknown) => T
  /** Human-readable resource name used in error messages, e.g. "devices". */
  resource: string
  /** Verb used in error messages, e.g. "load" -> "Could not load devices". */
  action?: string
  method?: HttpMethod
  body?: unknown
  signal?: AbortSignal
  timeoutMs?: number
}

function abortError(): DOMException {
  return new DOMException('The request was aborted', 'AbortError')
}

function extractServerError(payload: unknown): string | null {
  if (typeof payload === 'object' && payload !== null && 'error' in payload) {
    const { error } = payload as { error: unknown }
    if (typeof error === 'string' && error.trim()) return error.trim()
  }
  return null
}

/**
 * Thin fetch wrapper shared by every API caller:
 * - resolves paths against VITE_API_BASE_URL
 * - applies VITE_API_TIMEOUT_MS (covers headers *and* body)
 * - attaches X-API-Key when VITE_API_KEY is set
 * - converts non-2xx responses into ApiError using the backend's {"error": "..."} body
 * - re-throws caller aborts as DOMException("AbortError") so components can ignore them
 */
export async function apiRequest<T>(path: string, options: ApiRequestOptions<T>): Promise<T> {
  const { parse, resource, action = 'load', method = 'GET', body, signal } = options
  const timeoutMs = options.timeoutMs ?? env.apiTimeoutMs

  if (signal?.aborted) throw abortError()

  const controller = new AbortController()
  let timedOut = false
  const timer = window.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const forwardAbort = () => controller.abort()
  signal?.addEventListener('abort', forwardAbort, { once: true })

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (env.apiKey) headers['X-API-Key'] = env.apiKey

  try {
    let response: Response
    let text: string
    try {
      response = await fetch(buildApiUrl(path), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
        // Same-origin (proxy) requests keep cookies; cross-origin calls never send them,
        // which is what the backend's wildcard CORS policy requires.
        credentials: env.apiBaseUrl ? 'omit' : 'same-origin',
      })
      text = await response.text()
    } catch (error: unknown) {
      if (timedOut) {
        throw new ApiError(`Request to ${action} ${resource} timed out after ${timeoutMs} ms`, 'timeout')
      }
      if (signal?.aborted || isAbortError(error)) throw abortError()
      throw new ApiError(`Could not reach the Cerberus API to ${action} ${resource}`, 'network')
    }

    let payload: unknown = null
    let jsonError = false
    if (text.trim()) {
      try {
        payload = JSON.parse(text)
      } catch {
        jsonError = true
      }
    }

    if (!response.ok) {
      const serverMessage = extractServerError(payload)
      throw new ApiError(
        serverMessage
          ? `Could not ${action} ${resource}: ${serverMessage} (HTTP ${response.status})`
          : `Could not ${action} ${resource} (HTTP ${response.status})`,
        'http',
        response.status,
        payload,
      )
    }

    if (jsonError) {
      throw new ApiError(`The ${resource} API returned an invalid response`, 'invalid-response', response.status)
    }

    try {
      return parse(payload)
    } catch {
      throw new ApiError(`The ${resource} API returned an invalid response`, 'invalid-response', response.status, payload)
    }
  } finally {
    window.clearTimeout(timer)
    signal?.removeEventListener('abort', forwardAbort)
  }
}
