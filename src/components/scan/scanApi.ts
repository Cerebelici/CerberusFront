import { apiRequest } from '../../api/client'
import { API_ENDPOINTS } from '../../api/endpoints'
import { env } from '../../config/env'
import { expectArrayField, isRecord } from '../../api/validators'
import type { ScanLogDTO, ScanTriggerResponseDTO, ScanType } from './scanTypes'

const TRIGGER_ENDPOINTS: Record<ScanType, string> = {
  discovery: API_ENDPOINTS.triggerDiscoveryScan,
  vulnerability: API_ENDPOINTS.triggerVulnerabilityScan,
}

function parseTriggerResponse(body: unknown): ScanTriggerResponseDTO {
  if (!isRecord(body) || typeof body.message !== 'string' || body.status !== 'running') {
    throw new TypeError('Invalid scan trigger payload')
  }
  return body as unknown as ScanTriggerResponseDTO
}

/**
 * POST /api/scans/{type}/trigger.
 * Resolves on 202. Rejects with ApiError — status 409 when a scan of that type is
 * already running, 503 when the backend has no scheduler, or kind network/timeout.
 */
export function triggerScan(scanType: ScanType, signal?: AbortSignal): Promise<ScanTriggerResponseDTO> {
  return apiRequest(TRIGGER_ENDPOINTS[scanType], {
    method: 'POST',
    signal,
    resource: `${scanType} scan`,
    action: 'trigger',
    parse: parseTriggerResponse,
  })
}

/** GET /api/scans?limit=N — newest first. */
export function fetchScanHistory(limit: number, signal?: AbortSignal): Promise<ScanLogDTO[]> {
  const query = new URLSearchParams({ limit: String(limit) })
  return apiRequest(`${API_ENDPOINTS.scans}?${query.toString()}`, {
    signal,
    resource: 'scan history',
    parse: (body) => expectArrayField<ScanLogDTO>(body, 'scans'),
  })
}

/** Stable loader for useApiResource using VITE_SCAN_HISTORY_LIMIT. */
export function loadScanHistory(signal: AbortSignal): Promise<ScanLogDTO[]> {
  return fetchScanHistory(env.scanHistoryLimit, signal)
}
