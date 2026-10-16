/// <reference types="vite/client" />

// Browser-visible configuration. Documented in .env.example.
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_API_KEY?: string
  readonly VITE_API_TIMEOUT_MS?: string
  readonly VITE_STATUS_POLL_INTERVAL_MS?: string
  readonly VITE_SCAN_POLL_INTERVAL_MS?: string
  readonly VITE_SCAN_WATCH_TIMEOUT_MS?: string
  readonly VITE_SCAN_HISTORY_LIMIT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
