// Wire formats returned by SIEM_Home (internal/model/models.go). Optional fields
// mirror Go `omitempty` tags: the backend drops them when empty/zero.

export type DeviceStatus = 'up' | 'down'

export interface DeviceDTO {
  id: number
  current_ip: string
  ip?: string
  mac?: string
  hostname?: string
  vendor?: string
  status: DeviceStatus
  first_seen: string
  last_seen: string
  label?: string
  criticality?: string
  /** Host risk R_h in [0, 10]; omitted by the backend when 0. */
  risk?: number
  /** Host health H_h in [0, 100]. */
  score?: number
  services_count?: number
  vulnerabilities_count?: number
}

export type ServiceState = 'open' | 'filtered' | 'closed'

export interface ServiceDTO {
  id: number
  device_id: number
  device_ip?: string
  port: number
  protocol: string
  service_name?: string
  product?: string
  version?: string
  state: ServiceState
  updated_at: string
}

export type VulnerabilityStatus = 'open' | 'resolved'

export interface VulnerabilityDTO {
  id: number
  device_id: number
  device_ip?: string
  service_port: number
  cve_id: string
  title?: string
  /** "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "UNKNOWN" */
  severity: string
  cvss_score: number
  description?: string
  reference_url?: string
  detected_at: string
  status: VulnerabilityStatus
  first_detected_at?: string
  last_seen_at?: string
  resolved_at?: string
}

export interface CapabilitiesDTO {
  nmap_path: string
  nmap_version: string
  vuln_script_ok: boolean
  raw_socket: boolean
  effective_mode: 'privileged' | 'unprivileged'
  warnings?: string[]
}

export interface SystemStatusDTO {
  uptime: string
  uptime_seconds: number
  active_devices: number
  total_devices: number
  /** Count of services in the "open" state. */
  total_services: number
  /** Count of vulnerabilities in the "open" state. */
  total_vulnerabilities: number
  discovery_next_run?: string | null
  vuln_next_run?: string | null
  is_discovery_running: boolean
  is_vuln_running: boolean
  capabilities: CapabilitiesDTO | null
  incidents_open?: number
  fleet_score: number | null
  posture_status?: string
}

export interface DevicePostureSummaryDTO {
  device_id: number
  current_ip: string
  hostname?: string
  managed: boolean
  risk: number
  score: number
  open_vulns: number
  max_cve: number
}

export interface PostureReportDTO {
  computed_at: string
  policy_version: string
  /** Fleet health in [0, 100]; null when there are no active assets. */
  fleet_score: number | null
  posture_status?: string
  active_devices: number
  mean_risk: number
  max_risk: number
  penalty_total: number
  device_scores: DevicePostureSummaryDTO[]
}
