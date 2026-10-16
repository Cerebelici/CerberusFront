import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, errorMessage, isAbortError } from '../../api/client'
import { triggerScan } from './scanApi'
import { BUSY_PHASES, type ScanType, type TriggerState } from './scanTypes'
import { latestScanId, watchTriggeredScan } from './scanWatcher'

const IDLE: TriggerState = { phase: 'idle', message: null, scan: null }

function serverError(error: ApiError): string | null {
  const body = error.body
  if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') {
    return body.error
  }
  return null
}

export interface TriggerScanController {
  state: TriggerState
  busy: boolean
  trigger: () => void
}

/**
 * Owns the full lifecycle of a manually triggered scan:
 * submit -> 202 -> watch scan log until completed/failed, with explicit states for
 * 409 conflicts and transport errors. `onUpdate` fires whenever the server-side
 * picture changed (accepted, running, settled) so callers can refresh status/history.
 */
export function useTriggerScan(scanType: ScanType, onUpdate?: () => void): TriggerScanController {
  const [state, setState] = useState<TriggerState>(IDLE)
  const controllerRef = useRef<AbortController | null>(null)
  const onUpdateRef = useRef(onUpdate)

  useEffect(() => {
    onUpdateRef.current = onUpdate
  }, [onUpdate])

  // Stop polling when the page unmounts.
  useEffect(() => () => controllerRef.current?.abort(), [])

  const run = useCallback(async () => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    const { signal } = controller
    const notify = () => {
      if (!signal.aborted) onUpdateRef.current?.()
    }

    setState({ phase: 'submitting', message: null, scan: null })

    try {
      const baselineScanId = await latestScanId(signal)
      const accepted = await triggerScan(scanType, signal)
      setState({ phase: 'queued', message: accepted.message, scan: null })
      notify()

      const outcome = await watchTriggeredScan(scanType, baselineScanId, signal, (scan) => {
        setState({ phase: 'running', message: `Scan #${scan.id} running against ${scan.target_spec}`, scan })
        notify()
      })
      setState(outcome)
    } catch (error: unknown) {
      if (isAbortError(error)) return
      if (error instanceof ApiError && error.status === 409) {
        setState({
          phase: 'conflict',
          message: `${serverError(error) ?? `A ${scanType} scan is already in progress`}. Wait for it to finish before triggering another.`,
          scan: null,
        })
      } else {
        setState({ phase: 'error', message: errorMessage(error, `Could not trigger ${scanType} scan`), scan: null })
      }
    } finally {
      notify()
    }
  }, [scanType])

  const trigger = useCallback(() => {
    void run()
  }, [run])

  return { state, busy: BUSY_PHASES.includes(state.phase), trigger }
}
