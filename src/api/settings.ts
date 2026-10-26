import { apiRequest } from './client';

export interface NetworkInterfaceDTO {
  name: string;
  ipv4: string;
  cidr: string;
  mac: string;
  is_default: boolean;
}

export interface CapabilitiesDTO {
  nmap_path: string;
  nmap_version: string;
  vuln_script_ok: boolean;
  raw_socket: boolean;
  effective_mode: 'privileged' | 'unprivileged';
  warnings?: string[];
}

export interface AppSettingsDTO {
  network_mode: 'auto' | 'interface' | 'custom';
  selected_interface: string;
  custom_network_cidr: string;
  effective_cidr: string;
  effective_exclude_ip: string;
  scan_ports: string;
  discovery_interval_sec: number;
  vuln_interval_sec: number;
  unprivileged_mode: boolean;
  nmap_path: string;
}

export interface SettingsResponseDTO {
  settings: AppSettingsDTO;
  interfaces: NetworkInterfaceDTO[];
  capabilities: CapabilitiesDTO | null;
}

function parseSettings(body: unknown): SettingsResponseDTO {
  if (typeof body !== 'object' || body === null || !('settings' in body)) {
    throw new Error('Invalid settings response from backend');
  }
  return body as SettingsResponseDTO;
}

export async function fetchSettings(signal?: AbortSignal): Promise<SettingsResponseDTO> {
  return apiRequest('/api/settings', {
    resource: 'settings',
    parse: parseSettings,
    signal,
  });
}

export async function saveSettings(settings: AppSettingsDTO, signal?: AbortSignal): Promise<SettingsResponseDTO> {
  return apiRequest('/api/settings', {
    resource: 'settings',
    action: 'save',
    method: 'PUT',
    body: settings,
    parse: parseSettings,
    signal,
  });
}

export async function setupNmapPrivileges(signal?: AbortSignal): Promise<CapabilitiesDTO> {
  return apiRequest('/api/settings/privileges', {
    resource: 'privileges',
    action: 'configure',
    method: 'POST',
    parse: (body: unknown) => body as CapabilitiesDTO,
    signal,
  });
}

