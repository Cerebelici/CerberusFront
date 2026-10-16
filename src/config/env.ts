// Single source of truth for runtime configuration. Every value comes from
// import.meta.env (see .env.example); the numbers below are only fallbacks
// applied when a variable is missing or malformed.

function readPositiveInt(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value <= 0) {
    console.warn(`[config] ${name}="${raw}" is not a positive integer; using ${fallback}.`)
    return fallback
  }
  return value
}

function readBaseUrl(raw: string | undefined): string {
  // '' means "same origin" (requests go through the Vite proxy in development).
  return (raw ?? '').trim().replace(/\/+$/, '')
}

const source = import.meta.env

export interface AppConfig {
  /** Prefix for every API path. Empty string = same-origin. */
  readonly apiBaseUrl: string
  /** Optional key sent as X-API-Key (backend CERBERUS_API_KEY). */
  readonly apiKey: string | null
  readonly apiTimeoutMs: number
  readonly statusPollIntervalMs: number
  readonly scanPollIntervalMs: number
  readonly scanWatchTimeoutMs: number
  readonly scanHistoryLimit: number
}

export const env: AppConfig = Object.freeze({
  apiBaseUrl: readBaseUrl(source.VITE_API_BASE_URL),
  apiKey: source.VITE_API_KEY?.trim() || null,
  apiTimeoutMs: readPositiveInt('VITE_API_TIMEOUT_MS', source.VITE_API_TIMEOUT_MS, 10_000),
  statusPollIntervalMs: readPositiveInt('VITE_STATUS_POLL_INTERVAL_MS', source.VITE_STATUS_POLL_INTERVAL_MS, 30_000),
  scanPollIntervalMs: readPositiveInt('VITE_SCAN_POLL_INTERVAL_MS', source.VITE_SCAN_POLL_INTERVAL_MS, 3_000),
  scanWatchTimeoutMs: readPositiveInt('VITE_SCAN_WATCH_TIMEOUT_MS', source.VITE_SCAN_WATCH_TIMEOUT_MS, 900_000),
  scanHistoryLimit: readPositiveInt('VITE_SCAN_HISTORY_LIMIT', source.VITE_SCAN_HISTORY_LIMIT, 50),
})
