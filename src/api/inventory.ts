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
