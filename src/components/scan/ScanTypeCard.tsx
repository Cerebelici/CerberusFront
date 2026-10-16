import { formatDate } from '../../uptime'
import ScanStatusIndicator from './ScanStatusIndicator'
import { resolveIndicatorState } from './scanIndicatorState'
import TriggerScanButton from './TriggerScanButton'
import type { ScanLogDTO, ScanTypeDefinition } from './scanTypes'
import { summarizeScan } from './scanWatcher'
import type { TriggerScanController } from './useTriggerScan'

interface ScanTypeCardProps {
  definition: ScanTypeDefinition
  controller: TriggerScanController
  /** null while GET /api/status has not answered yet. */
  serverRunning: boolean | null
  nextRun: string | null | undefined
  lastScan: ScanLogDTO | null
  focused: boolean
}

const FEEDBACK_TONE: Record<string, 'info' | 'success' | 'warning' | 'danger'> = {
  submitting: 'info',
  queued: 'info',
  running: 'info',
  completed: 'success',
  conflict: 'warning',
  failed: 'danger',
  error: 'danger',
}

function ScanTypeCard({ definition, controller, serverRunning, nextRun, lastScan, focused }: ScanTypeCardProps) {
  const { state, trigger } = controller
  const indicator = resolveIndicatorState({
    serverRunning,
    phase: state.phase,
    lastScanStatus: lastScan?.status ?? null,
  })

  return (
    <section
      className={`scan-card${focused ? ' scan-card--focused' : ''}`}
      aria-labelledby={`scan-card-${definition.type}`}
    >
      <header className="scan-card__header">
        <h2 className="scan-card__title" id={`scan-card-${definition.type}`}>{definition.title}</h2>
        <ScanStatusIndicator state={indicator} />
      </header>

      <p className="scan-card__description">{definition.description}</p>

      <dl className="scan-card__meta">
        <dt>Next scheduled run</dt>
        <dd>{nextRun ? formatDate(nextRun) : '—'}</dd>
        <dt>Last run</dt>
        <dd>{lastScan ? summarizeScan(lastScan) : 'No runs recorded yet'}</dd>
      </dl>

      <TriggerScanButton
        label={definition.triggerLabel}
        icon={definition.icon}
        phase={state.phase}
        serverRunning={serverRunning === true}
        onTrigger={trigger}
      />

      {state.message && (
        <p
          className={`scan-card__feedback scan-card__feedback--${FEEDBACK_TONE[state.phase] ?? 'info'}`}
          role={state.phase === 'error' || state.phase === 'failed' ? 'alert' : 'status'}
        >
          {state.message}
        </p>
      )}
    </section>
  )
}

export default ScanTypeCard
