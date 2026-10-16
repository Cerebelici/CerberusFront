import type { ScanIndicatorState } from './scanIndicatorState'

const LABELS: Record<ScanIndicatorState, string> = {
  running: 'Running',
  queued: 'Queued',
  idle: 'Idle',
  completed: 'Last run completed',
  failed: 'Last run failed',
  error: 'Request failed',
  unknown: 'Status unavailable',
}

interface ScanStatusIndicatorProps {
  state: ScanIndicatorState
}

function ScanStatusIndicator({ state }: ScanStatusIndicatorProps) {
  return (
    <span className={`scan-status scan-status--${state}`} role="status" aria-live="polite">
      <span className="scan-status__dot" aria-hidden="true" />
      <span className="scan-status__label">{LABELS[state]}</span>
    </span>
  )
}

export default ScanStatusIndicator
