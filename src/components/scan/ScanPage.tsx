import './Scan.css'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useApiResource } from '../../hooks/useApiResource'
import { useSystemStatus } from '../../state/useSystemStatus'
import ScanHistoryTable from './ScanHistoryTable'
import ScanTypeCard from './ScanTypeCard'
import { loadScanHistory } from './scanApi'
import { SCAN_TYPE_DEFINITIONS, parseScanType, type ScanLogDTO, type ScanType } from './scanTypes'
import { useTriggerScan } from './useTriggerScan'

function scanTypeFromNavigationState(state: unknown): ScanType | null {
  if (
    typeof state !== 'object' ||
    state === null ||
    !('triggerScanType' in state) ||
    typeof state.triggerScanType !== 'string'
  ) {
    return null
  }

  return parseScanType(state.triggerScanType)
}

function ScanPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const focusedType = parseScanType(searchParams.get('type'))
  const handledNavigationKey = useRef<string | null>(null)

  const { status, error: statusError, scanGeneration, refresh } = useSystemStatus()
  const anyRunning = status !== null && (status.is_discovery_running || status.is_vuln_running)
  // Refetch history when a scan starts or finishes (as seen by the shared status poller).
  const history = useApiResource(loadScanHistory, `${scanGeneration}:${anyRunning}`)
  const reloadHistory = history.reload
  const setHistoryData = history.setData

  const handleUpdate = useCallback(() => {
    refresh()
    reloadHistory()
  }, [refresh, reloadHistory])

  const handleHistoryCleared = useCallback(() => {
    setHistoryData([])
    refresh()
    reloadHistory()
  }, [setHistoryData, refresh, reloadHistory])

  const discoveryController = useTriggerScan('discovery', handleUpdate)
  const vulnerabilityController = useTriggerScan('vulnerability', handleUpdate)
  const { trigger: triggerDiscovery } = discoveryController
  const { trigger: triggerVulnerability } = vulnerabilityController
  const controllers = { discovery: discoveryController, vulnerability: vulnerabilityController }

  useEffect(() => {
    const scanType = scanTypeFromNavigationState(location.state)
    if (!scanType || handledNavigationKey.current === location.key) return

    handledNavigationKey.current = location.key
    if (scanType === 'discovery') {
      triggerDiscovery()
    } else {
      triggerVulnerability()
    }
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null })
  }, [location, navigate, triggerDiscovery, triggerVulnerability])

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
      {/* <header className="scan-page__header">
        <h1 className="scan-page__title">SCANS</h1>
        {capabilities && (
          <p className="scan-page__caps">
            nmap {capabilities.nmap_version || 'unknown'} · {capabilities.effective_mode} mode ·
            vulners script {capabilities.vuln_script_ok ? 'available' : 'unavailable'}
          </p>
        )}
      </header> */}

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

      <ScanHistoryTable scans={history.data} loading={history.loading} error={history.error} onCleared={handleHistoryCleared} />
    </div>
  )
}

export default ScanPage
