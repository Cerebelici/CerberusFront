import type { ScanLogStatus, TriggerPhase } from './scanTypes'

export type ScanIndicatorState = 'running' | 'queued' | 'idle' | 'completed' | 'failed' | 'error' | 'unknown'

/** Collapses server status, the local trigger lifecycle and the last scan log into one state. */
export function resolveIndicatorState(options: {
  serverRunning: boolean | null
  phase: TriggerPhase
  lastScanStatus: ScanLogStatus | null
}): ScanIndicatorState {
  const { serverRunning, phase, lastScanStatus } = options
  if (serverRunning || phase === 'running' || phase === 'conflict') return 'running'
  if (phase === 'submitting' || phase === 'queued') return 'queued'
  if (phase === 'error') return 'error'
  if (phase === 'failed') return 'failed'
  if (phase === 'completed') return 'completed'
  if (serverRunning === null) return 'unknown'
  if (lastScanStatus === 'failed') return 'failed'
  if (lastScanStatus === 'completed') return 'completed'
  return 'idle'
}
