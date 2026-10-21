import { apiRequest } from './client'
import { API_ENDPOINTS } from './endpoints'
import type { DeviceDTO, ServiceDTO, VulnerabilityDTO } from './types'
import { expectArrayField } from './validators'

export function fetchDevices(signal?: AbortSignal): Promise<DeviceDTO[]> {
  return apiRequest(API_ENDPOINTS.devices, {
    signal,
    resource: 'devices',
    parse: (body) => expectArrayField<DeviceDTO>(body, 'devices'),
  })
}

export function fetchServices(signal?: AbortSignal): Promise<ServiceDTO[]> {
  return apiRequest(API_ENDPOINTS.services, {
    signal,
    resource: 'services',
    parse: (body) => expectArrayField<ServiceDTO>(body, 'services'),
  })
}

export function fetchVulnerabilities(signal?: AbortSignal): Promise<VulnerabilityDTO[]> {
  return apiRequest(API_ENDPOINTS.vulnerabilities, {
    signal,
    resource: 'vulnerabilities',
    parse: (body) => expectArrayField<VulnerabilityDTO>(body, 'vulnerabilities'),
  })
}

export function deleteDevice(id: number, signal?: AbortSignal): Promise<{ status: string }> {
  return apiRequest(`${API_ENDPOINTS.devices}/${id}`, {
    signal,
    method: 'DELETE',
    resource: 'device',
    action: 'delete',
    parse: (body) => body as { status: string },
  })
}

export function clearAllDevices(signal?: AbortSignal): Promise<{ status: string; deleted: number }> {
  return apiRequest(API_ENDPOINTS.devices, {
    signal,
    method: 'DELETE',
    resource: 'devices',
    action: 'clear all',
    parse: (body) => body as { status: string; deleted: number },
  })
}

export function clearScanHistory(signal?: AbortSignal): Promise<{ status: string; deleted: number }> {
  return apiRequest(API_ENDPOINTS.scans, {
    signal,
    method: 'DELETE',
    resource: 'scans',
    action: 'clear scan history',
    parse: (body) => body as { status: string; deleted: number },
  })
}

export function deleteService(id: number, signal?: AbortSignal): Promise<{ status: string }> {
  return apiRequest(`${API_ENDPOINTS.services}/${id}`, {
    signal,
    method: 'DELETE',
    resource: 'service',
    action: 'delete',
    parse: (body) => body as { status: string },
  })
}

export function deleteVulnerability(id: number, signal?: AbortSignal): Promise<{ status: string }> {
  return apiRequest(`${API_ENDPOINTS.vulnerabilities}/${id}`, {
    signal,
    method: 'DELETE',
    resource: 'vulnerability',
    action: 'delete',
    parse: (body) => body as { status: string },
  })
}
