import './Scan.css'
import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApiResource } from '../../hooks/useApiResource'
import { useSystemStatus } from '../../state/useSystemStatus'
import ScanHistoryTable from './ScanHistoryTable'
import ScanTypeCard from './ScanTypeCard'
import { loadScanHistory } from './scanApi'
import { SCAN_TYPE_DEFINITIONS, parseScanType, type ScanLogDTO, type ScanType } from './scanTypes'
import { useTriggerScan } from './useTriggerScan'

function ScanPage() {
  const [searchParams] = useSearchParams()
  const focusedType = parseScanType(searchParams.get('type'))

  const { status, error: statusError, scanGeneration, refresh } = useSystemStatus()
  const anyRunning = status !== null && (status.is_discovery_running || status.is_vuln_running)
  // Refetch history when a scan starts or finishes (as seen by the shared status poller).
  const history = useApiResource(loadScanHistory, `${scanGeneration}:${anyRunning}`)
  const reloadHistory = history.reload

  const handleUpdate = useCallback(() => {
    refresh()
    reloadHistory()
  }, [refresh, reloadHistory])

  const controllers = {
    discovery: useTriggerScan('discovery', handleUpdate),
    vulnerability: useTriggerScan('vulnerability', handleUpdate),
  }

  const lastScanByType = useMemo(() => {
    const result: Record<ScanType, ScanLogDTO | null> = { discovery: null, vulnerability: null }
    for (const scan of history.data ?? []) {
      // GET /api/scans is ordered newest first, so the first match per type wins.
      if ((scan.scan_type === 'discovery' || scan.scan_type === 'vulnerability') && !result[scan.scan_type]) {
        result[scan.scan_type] = scan
      }
    }
    return result
  }, [history.data])

  const capabilities = status?.capabilities ?? null

  return (
    <div className="scan-page">
      <header className="scan-page__header">
        <h1 className="scan-page__title">SCANS</h1>
        {capabilities && (
          <p className="scan-page__caps">
            nmap {capabilities.nmap_version || 'unknown'} · {capabilities.effective_mode} mode ·
            vulners script {capabilities.vuln_script_ok ? 'available' : 'unavailable'}
          </p>
        )}
      </header>

      {statusError && <p className="scan-page__alert" role="alert">{statusError}</p>}
      {capabilities?.warnings && capabilities.warnings.length > 0 && (
        <ul className="scan-page__warnings" aria-label="Scanner warnings">
          {capabilities.warnings.map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      )}

      <div className="scan-page__cards">
        {SCAN_TYPE_DEFINITIONS.map((definition) => (
          <ScanTypeCard
            key={definition.type}
            definition={definition}
            controller={controllers[definition.type]}
            serverRunning={
              status === null
                ? null
                : definition.type === 'discovery'
                  ? status.is_discovery_running
                  : status.is_vuln_running
            }
            nextRun={definition.type === 'discovery' ? status?.discovery_next_run : status?.vuln_next_run}
            lastScan={lastScanByType[definition.type]}
            focused={focusedType === definition.type}
          />
        ))}
      </div>

      <ScanHistoryTable scans={history.data} loading={history.loading} error={history.error} />
    </div>
  )
}

export default ScanPage
