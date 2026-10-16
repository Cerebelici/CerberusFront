import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { errorMessage, isAbortError } from '../api/client'
import { fetchSystemStatus } from '../api/system'
import type { SystemStatusDTO } from '../api/types'
import { env } from '../config/env'
import { SystemStatusContext, type SystemStatusContextValue } from './systemStatusContext'

const START_TIME_TOLERANCE_MS = 5_000

/**
 * Single poller for GET /api/status shared by the side nav, dashboard and scan page.
 * Polls every VITE_STATUS_POLL_INTERVAL_MS while idle and every VITE_SCAN_POLL_INTERVAL_MS
 * while any scan is running, so scan state changes show up quickly.
 */
export function SystemStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SystemStatusDTO | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [backendStartedAt, setBackendStartedAt] = useState<string | null>(null)
  const [scanGeneration, setScanGeneration] = useState(0)
  const [refreshToken, setRefreshToken] = useState(0)
  const lastRunning = useRef({ discovery: false, vulnerability: false })

  const scanRunning = status !== null && (status.is_discovery_running || status.is_vuln_running)
  const intervalMs = scanRunning ? env.scanPollIntervalMs : env.statusPollIntervalMs

  useEffect(() => {
    const controller = new AbortController()
    let timer: number | undefined

    const poll = async () => {
      try {
        const next = await fetchSystemStatus(controller.signal)
        const previous = lastRunning.current
        if (
          (previous.discovery && !next.is_discovery_running) ||
          (previous.vulnerability && !next.is_vuln_running)
        ) {
          setScanGeneration((generation) => generation + 1)
        }
        lastRunning.current = {
          discovery: next.is_discovery_running,
          vulnerability: next.is_vuln_running,
        }
        // Only move the start time when it shifts by more than the tolerance (i.e. the
        // backend restarted), so polling latency doesn't make the uptime counter jitter.
        const startedAtMs = Date.now() - next.uptime_seconds * 1000
        setBackendStartedAt((current) =>
          current !== null && Math.abs(Date.parse(current) - startedAtMs) < START_TIME_TOLERANCE_MS
            ? current
            : new Date(startedAtMs).toISOString(),
        )
        setStatus(next)
        setError(null)
      } catch (reason: unknown) {
        if (isAbortError(reason)) return
        setError(errorMessage(reason, 'Could not load system status'))
      }
      if (!controller.signal.aborted) {
        timer = window.setTimeout(() => void poll(), intervalMs)
      }
    }

    void poll()

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [intervalMs, refreshToken])

  const refresh = useCallback(() => setRefreshToken((token) => token + 1), [])

  const value = useMemo<SystemStatusContextValue>(
    () => ({ status, error, backendStartedAt, scanGeneration, refresh }),
    [status, error, backendStartedAt, scanGeneration, refresh],
  )

  return <SystemStatusContext.Provider value={value}>{children}</SystemStatusContext.Provider>
}
