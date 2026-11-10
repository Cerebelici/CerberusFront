// Logical IPC paths routed to Wails bridge methods by wailsBridge.ts. They are not
// HTTP routes: the daemon no longer serves a UI REST API. The ingest API contract lives
// in openapi.yaml.
// Note: GetTimeline is called directly by the Timeline widget in Home.tsx.
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
