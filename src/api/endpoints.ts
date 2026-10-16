// REST paths exposed by SIEM_Home (internal/api/server.go). Keep in sync with openapi.yaml.
// Note: GET /api/timeline is intentionally not listed here — the Timeline widget keeps its
// own, unchanged data binding in Home.tsx.
export const API_ENDPOINTS = {
  devices: '/api/devices',
  services: '/api/services',
  vulnerabilities: '/api/vulnerabilities',
  status: '/api/status',
  posture: '/api/posture',
  scans: '/api/scans',
  triggerDiscoveryScan: '/api/scans/discovery/trigger',
  triggerVulnerabilityScan: '/api/scans/vulnerability/trigger',
} as const
