import { Icon, type IconName } from '../Icon/Icon'
import type { TriggerPhase } from './scanTypes'

interface TriggerScanButtonProps {
  label: string
  icon: IconName
  phase: TriggerPhase
  /** True while the backend reports a scan of this type in progress. */
  serverRunning: boolean
  onTrigger: () => void
}

const BUSY_LABELS: Partial<Record<TriggerPhase, string>> = {
  submitting: 'Submitting…',
  queued: 'Queued…',
  running: 'Scanning…',
}

function TriggerScanButton({ label, icon, phase, serverRunning, onTrigger }: TriggerScanButtonProps) {
  const busyLabel = BUSY_LABELS[phase] ?? (serverRunning ? 'Scan in progress…' : null)
  const busy = busyLabel !== null

  return (
    <button
      type="button"
      className="btn btn--light scan-trigger"
      onClick={onTrigger}
      disabled={busy}
      aria-busy={busy}
    >
      <Icon
        name={busy ? 'progress_activity' : icon}
        className={`scan-trigger__icon${busy ? ' scan-trigger__icon--spin' : ''}`}
      />
      <span>{busyLabel ?? label}</span>
    </button>
  )
}

export default TriggerScanButton
