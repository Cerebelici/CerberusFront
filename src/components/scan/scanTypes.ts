import type { IconName } from '../Icon/Icon'

/** Scan types an operator can trigger manually (POST /api/scans/{type}/trigger). */
export type ScanType = 'discovery' | 'vulnerability'

/** Every scan_type the backend writes to the scan log ("immediate" = auto-audit of new hosts). */
export type ScanLogType = ScanType | 'immediate'

export type ScanLogStatus = 'running' | 'completed' | 'failed'

/** GET /api/scans item (internal/model/models.go ScanLog). */
export interface ScanLogDTO {
  id: number
  scan_type: ScanLogType
  status: ScanLogStatus
  target_spec: string
  hosts_found: number
  vulns_found: number
  duration_ms: number
  error_message?: string
  started_at: string
  completed_at?: string | null
}

/** 202 body of POST /api/scans/{type}/trigger. */
export interface ScanTriggerResponseDTO {
  message: string
  status: 'running'
  scan_type?: ScanType
}

/** Lifecycle of a scan triggered from this browser tab. */
export type TriggerPhase =
  | 'idle'
  | 'submitting' // POST in flight
  | 'queued'     // 202 received, waiting for the worker to pick it up
  | 'running'    // scan log row exists with status "running"
  | 'completed'
  | 'failed'
  | 'conflict'   // 409: a scan of this type was already running
  | 'error'      // network / HTTP / timeout failure

export interface TriggerState {
  phase: TriggerPhase
  message: string | null
  scan: ScanLogDTO | null
}

export const BUSY_PHASES: readonly TriggerPhase[] = ['submitting', 'queued', 'running']

export interface ScanTypeDefinition {
  type: ScanType
  title: string
  description: string
  icon: IconName
  triggerLabel: string
}

export const SCAN_TYPE_DEFINITIONS: readonly ScanTypeDefinition[] = [
  {
    type: 'discovery',
    title: 'Discovery scan',
    description: 'Sweeps the configured subnet for live hosts. New hosts are queued for an immediate vulnerability audit.',
    icon: 'radar',
    triggerLabel: 'Trigger discovery scan',
  },
  {
    type: 'vulnerability',
    title: 'Vulnerability scan',
    description: 'Runs service detection and CVE checks against every device currently marked as up.',
    icon: 'bug_report',
    triggerLabel: 'Trigger vulnerability scan',
  },
]

export function parseScanType(value: string | null): ScanType | null {
  return value === 'discovery' || value === 'vulnerability' ? value : null
}
