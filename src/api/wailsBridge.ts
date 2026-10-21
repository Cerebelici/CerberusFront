/**
 * Wails v2 IPC Bridge definition and router for Cerberus.
 * Maps REST paths and actions to Go Bridge methods when running inside the Wails desktop container.
 */

export interface WailsBridge {
  GetStatus(): Promise<unknown>;
  GetPosture(): Promise<unknown>;
  GetTimeline(from: string, to: string, status: string, vulnerableOnly: boolean): Promise<unknown>;
  GetDevices(status: string): Promise<unknown>;
  GetDeviceByID(id: number): Promise<unknown>;
  UpdateDevice(id: number, label: string | null, criticality: string | null, notes: string | null): Promise<unknown>;
  DeleteDevice(id: number): Promise<unknown>;
  GetServices(): Promise<unknown>;
  GetVulnerabilities(severity: string): Promise<unknown>;
  GetScans(limit: number): Promise<unknown>;
  TriggerDiscovery(): Promise<unknown>;
  TriggerVulnerabilityScan(): Promise<unknown>;
  GetSettings(): Promise<unknown>;
  UpdateSettings(req: unknown): Promise<unknown>;
  SetupNmapAndPrivileges(): Promise<unknown>;
}

declare global {
  interface Window {
    go?: {
      main?: {
        Bridge?: WailsBridge;
      };
    };
  }
}

export function isWailsApp(): boolean {
  return typeof window !== 'undefined' && Boolean(window.go?.main?.Bridge);
}

export function getWailsBridge(): WailsBridge | null {
  if (typeof window !== 'undefined' && window.go?.main?.Bridge) {
    return window.go.main.Bridge;
  }
  return null;
}

/**
 * Dispatches an API path to the corresponding Wails Bridge method.
 * Returns null if not in Wails mode or if path has no IPC equivalent.
 */
export async function dispatchWailsIpc(
  path: string,
  method: string = 'GET',
  body?: unknown,
): Promise<unknown | null> {
  const bridge = getWailsBridge();
  if (!bridge) return null;

  const [rawPath, queryString] = path.split('?');
  const cleanPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  const query = new URLSearchParams(queryString || '');

  // 1. Status & Posture
  if (cleanPath === '/api/status' && method === 'GET') {
    return await bridge.GetStatus();
  }
  if (cleanPath === '/api/posture' && method === 'GET') {
    return await bridge.GetPosture();
  }

  // 2. Timeline
  if (cleanPath === '/api/timeline' && method === 'GET') {
    const from = query.get('from') || '';
    const to = query.get('to') || '';
    const status = query.get('status') || '';
    const vulnOnly = query.get('vulnerable_only') === 'true' || query.get('vulnerable') === 'true';
    return await bridge.GetTimeline(from, to, status, vulnOnly);
  }

  // 3. Devices
  if (cleanPath === '/api/devices' && method === 'GET') {
    const status = query.get('status') || '';
    return await bridge.GetDevices(status);
  }

  const deviceMatch = cleanPath.match(/^\/api\/devices\/(\d+)$/);
  if (deviceMatch) {
    const deviceId = parseInt(deviceMatch[1], 10);
    if (method === 'GET') {
      return await bridge.GetDeviceByID(deviceId);
    }
    if (method === 'PATCH' && body && typeof body === 'object') {
      const b = body as { label?: string; criticality?: string; notes?: string };
      return await bridge.UpdateDevice(
        deviceId,
        b.label !== undefined ? b.label : null,
        b.criticality !== undefined ? b.criticality : null,
        b.notes !== undefined ? b.notes : null,
      );
    }
    if (method === 'DELETE') {
      return await bridge.DeleteDevice(deviceId);
    }
  }

  // 4. Services
  if (cleanPath === '/api/services' && method === 'GET') {
    return await bridge.GetServices();
  }

  // 5. Vulnerabilities
  if (cleanPath === '/api/vulnerabilities' && method === 'GET') {
    const severity = query.get('severity') || '';
    return await bridge.GetVulnerabilities(severity);
  }

  // 6. Scans
  if (cleanPath === '/api/scans' && method === 'GET') {
    const limit = parseInt(query.get('limit') || '50', 10);
    return await bridge.GetScans(limit);
  }
  if (cleanPath === '/api/scans/discovery/trigger' && method === 'POST') {
    return await bridge.TriggerDiscovery();
  }
  if (cleanPath === '/api/scans/vulnerability/trigger' && method === 'POST') {
    return await bridge.TriggerVulnerabilityScan();
  }

  // 7. Settings
  if (cleanPath === '/api/settings' && method === 'GET') {
    return await bridge.GetSettings();
  }
  if (cleanPath === '/api/settings' && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
    return await bridge.UpdateSettings(body);
  }
  if (cleanPath === '/api/settings/privileges' && method === 'POST') {
    return await bridge.SetupNmapAndPrivileges();
  }

  return null;
}
