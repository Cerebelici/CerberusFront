import { createContext } from 'react'
import type { SystemStatusDTO } from '../api/types'

export interface SystemStatusContextValue {
  status: SystemStatusDTO | null
  error: string | null
  /** ISO timestamp of the backend process start, derived from uptime_seconds. */
  backendStartedAt: string | null
  /** Increments every time a running discovery/vulnerability scan is observed to finish. */
  scanGeneration: number
  /** Re-fetch GET /api/status immediately. */
  refresh: () => void
}

export const SystemStatusContext = createContext<SystemStatusContextValue | null>(null)
