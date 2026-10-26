import { fetchSystemStatus } from '../../api/system'
import { env } from '../../config/env'
import { fetchScanHistory } from './scanApi'
import type { ScanLogDTO, ScanType, TriggerState } from './scanTypes'

// Enough rows to see our scan even if discovery spawned many "immediate" audits meanwhile.
const WATCH_HISTORY_LIMIT = 200
// Consecutive polls with "not running" and no new scan log before we conclude the
// worker finished without recording anything (e.g. a vuln audit with zero active hosts).
const IDLE_POLLS_BEFORE_SETTLING = 2

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      window.clearTimeout(timer)
      reject(new DOMException('The operation was aborted', 'AbortError'))
    }
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', abort)
      resolve()
    }, ms)
    if (signal.aborted) abort()
    else signal.addEventListener('abort', abort, { once: true })
  })
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)} s`
  return `${Math.floor(seconds / 60)} min ${Math.round(seconds % 60)} s`
}

export function summarizeScan(scan: ScanLogDTO): string {
  if (scan.status === 'running') {
    return `Scan #${scan.id} running since ${new Date(scan.started_at).toLocaleTimeString()} (${scan.target_spec})`
  }
  if (scan.status === 'failed') {
    // A failed scan has no meaningful duration or counts; its error says what happened.
    return `Scan #${scan.id} failed: ${scan.error_message || 'no error message reported'} (${scan.target_spec})`
  }
  const hosts = `${scan.hosts_found} host${scan.hosts_found === 1 ? '' : 's'}`
  const findings = scan.scan_type === 'discovery' ? '' : `, ${scan.vulns_found} vulnerabilit${scan.vulns_found === 1 ? 'y' : 'ies'}`
  return `Scan #${scan.id} ${scan.status} in ${formatDuration(scan.duration_ms)}: ${hosts}${findings} (${scan.target_spec})`
}

/** Highest scan id currently in the log; scans created after a trigger have larger ids. */
export async function latestScanId(signal: AbortSignal): Promise<number> {
  const history = await fetchScanHistory(1, signal)
  return history.reduce((max, scan) => Math.max(max, scan.id), 0)
}

/**
 * Follows a triggered scan until it settles, using the scan log as the source of truth
 * and GET /api/status as a liveness signal. Never resolves silently: it always returns
 * a terminal TriggerState (completed / failed / error).
 */
export async function watchTriggeredScan(
  scanType: ScanType,
  baselineScanId: number,
  signal: AbortSignal,
  onRunning: (scan: ScanLogDTO) => void,
): Promise<TriggerState> {
  const deadline = Date.now() + env.scanWatchTimeoutMs
  let idlePolls = 0
  let reportedRunningId: number | null = null

  while (Date.now() < deadline) {
    await delay(env.scanPollIntervalMs, signal)

    const history = await fetchScanHistory(WATCH_HISTORY_LIMIT, signal)
    const ours = history
      .filter((scan) => scan.id > baselineScanId && scan.scan_type === scanType)
      .sort((a, b) => a.id - b.id)[0]

    if (ours) {
      if (ours.status === 'running') {
        idlePolls = 0
        if (reportedRunningId !== ours.id) {
          reportedRunningId = ours.id
          onRunning(ours)
        }
        continue
      }
      if (ours.status === 'failed') {
        return {
          phase: 'failed',
          message: `Scan #${ours.id} failed: ${ours.error_message || 'no error message reported'}`,
          scan: ours,
        }
      }
      return { phase: 'completed', message: summarizeScan(ours), scan: ours }
    }

    const status = await fetchSystemStatus(signal)
    const running = scanType === 'discovery' ? status.is_discovery_running : status.is_vuln_running
    if (running) {
      idlePolls = 0
      continue
    }

    idlePolls += 1
    if (idlePolls >= IDLE_POLLS_BEFORE_SETTLING) {
      return {
        phase: 'completed',
        message:
          scanType === 'vulnerability'
            ? 'Finished: there were no active devices to audit, so no scan was recorded.'
            : 'Finished without recording a scan log entry.',
        scan: null,
      }
    }
  }

  return {
    phase: 'error',
    message: `Stopped watching after ${Math.round(env.scanWatchTimeoutMs / 60000)} min. Check the scan history for the final result.`,
    scan: null,
  }
}
