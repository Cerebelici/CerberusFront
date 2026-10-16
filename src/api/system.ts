import { apiRequest } from './client'
import { API_ENDPOINTS } from './endpoints'
import type { PostureReportDTO, SystemStatusDTO } from './types'
import { isNonNegativeNumber, isOptionalTimestamp, isRecord } from './validators'

function parseSystemStatus(body: unknown): SystemStatusDTO {
  if (
    !isRecord(body) ||
    !isNonNegativeNumber(body.total_devices) ||
    !isNonNegativeNumber(body.active_devices) ||
    !isNonNegativeNumber(body.total_services) ||
    !isNonNegativeNumber(body.total_vulnerabilities) ||
    !isNonNegativeNumber(body.uptime_seconds) ||
    typeof body.is_discovery_running !== 'boolean' ||
    typeof body.is_vuln_running !== 'boolean' ||
    // next-run timestamps are `omitempty` on the backend (nil before the scheduler starts)
    !isOptionalTimestamp(body.discovery_next_run) ||
    !isOptionalTimestamp(body.vuln_next_run)
  ) {
    throw new TypeError('Invalid system status payload')
  }
  return body as unknown as SystemStatusDTO
}

function parsePostureReport(body: unknown): PostureReportDTO {
  if (
    !isRecord(body) ||
    !(body.fleet_score === null || typeof body.fleet_score === 'number') ||
    !Array.isArray(body.device_scores)
  ) {
    throw new TypeError('Invalid posture payload')
  }
  return body as unknown as PostureReportDTO
}

export function fetchSystemStatus(signal?: AbortSignal): Promise<SystemStatusDTO> {
  return apiRequest(API_ENDPOINTS.status, { signal, resource: 'system status', parse: parseSystemStatus })
}

export function fetchPosture(signal?: AbortSignal): Promise<PostureReportDTO> {
  return apiRequest(API_ENDPOINTS.posture, { signal, resource: 'posture report', parse: parsePostureReport })
}
