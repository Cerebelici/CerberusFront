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
  ClearAllDevices(): Promise<{ status: string; deleted: number }>;
  GetServices(): Promise<unknown>;
  DeleteService(id: number): Promise<unknown>;
  GetVulnerabilities(severity: string): Promise<unknown>;
  DeleteVulnerability(id: number): Promise<unknown>;
  GetScans(limit: number): Promise<unknown>;
  ClearScanHistory(): Promise<{ status: string; deleted: number }>;
  TriggerDiscovery(): Promise<unknown>;
  TriggerVulnerabilityScan(): Promise<unknown>;
  GetLogs(): Promise<unknown>;
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
    runtime?: {
      EventsOn?: (eventName: string, callback: (...data: unknown[]) => void) => () => void;
    };
  }
}

/**
 * Error thrown for an IPC result that the HTTP API would answer with a non-2xx status,
 * so callers handle both transports the same way.
 */
export class IpcHttpError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'IpcHttpError';
    this.status = status;
    this.body = body;
  }
}

/** Trigger results with status "conflict" are the IPC form of HTTP 409. */
function rejectConflict(result: unknown): unknown {
  if (typeof result === 'object' && result !== null && 'status' in result && result.status === 'conflict') {
    const message = 'error' in result && typeof result.error === 'string' ? result.error : 'A scan is already in progress';
    throw new IpcHttpError(message, 409, result);
  }
  return result;
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
  if (cleanPath === '/api/devices') {
    if (method === 'GET') {
      const status = query.get('status') || '';
      return await bridge.GetDevices(status);
    }
    if (method === 'DELETE') {
      return await bridge.ClearAllDevices();
    }
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
  const serviceMatch = cleanPath.match(/^\/api\/services\/(\d+)$/);
  if (serviceMatch && method === 'DELETE') {
    const serviceId = parseInt(serviceMatch[1], 10);
    return await bridge.DeleteService(serviceId);
  }

  // 5. Vulnerabilities
  if (cleanPath === '/api/vulnerabilities' && method === 'GET') {
    const severity = query.get('severity') || '';
    return await bridge.GetVulnerabilities(severity);
  }
  const vulnMatch = cleanPath.match(/^\/api\/vulnerabilities\/(\d+)$/);
  if (vulnMatch && method === 'DELETE') {
    const vulnId = parseInt(vulnMatch[1], 10);
    return await bridge.DeleteVulnerability(vulnId);
  }

  // 6. Scans
  if (cleanPath === '/api/scans') {
    if (method === 'GET') {
      const limit = parseInt(query.get('limit') || '50', 10);
      return await bridge.GetScans(limit);
    }
    if (method === 'DELETE') {
      return await bridge.ClearScanHistory();
    }
  }
  if (cleanPath === '/api/scans/discovery/trigger' && method === 'POST') {
    return rejectConflict(await bridge.TriggerDiscovery());
  }
  if (cleanPath === '/api/scans/vulnerability/trigger' && method === 'POST') {
    return rejectConflict(await bridge.TriggerVulnerabilityScan());
  }

  // 7. Daemon log
  if (cleanPath === '/api/logs' && method === 'GET') {
    return await bridge.GetLogs();
  }

  // 8. Settings
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

