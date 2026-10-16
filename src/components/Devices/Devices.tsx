import "./Devices.css"
import TableFilter from "../TableFilter/TableFilter"
import TableData from "../TableData/TableData"
import { useTableState } from "../TableData/useTableState"
import type { TableColumn } from "../TableData/TableTypes"
import { useMemo } from "react"
import { fetchDevices } from "../../api/inventory"
import type { DeviceDTO, DeviceStatus } from "../../api/types"
import { useApiResource } from "../../hooks/useApiResource"
import { useSystemStatus } from "../../state/useSystemStatus"
import { TABLE_STORAGE_KEYS } from "../../constants"

interface Device {
  id: number
  hostname: string | null
  vendor: string | null
  ip: string
  mac: string | null
  status: DeviceStatus
  riskScore: number
  vulnerabilitiesCount: number | null
  servicesCount: number | null
  lastSeen: string
}

function toDevice(deviceJSON: DeviceDTO): Device {
  return {
    id: deviceJSON.id,
    // An operator-assigned label wins over the scanned hostname.
    hostname: deviceJSON.label || deviceJSON.hostname || null,
    vendor: deviceJSON.vendor ?? null,
    ip: deviceJSON.current_ip,
    mac: deviceJSON.mac ?? null,
    status: deviceJSON.status,
    // Host risk R_h (0–10) from the posture engine; the backend omits it when 0.
    riskScore: deviceJSON.risk ?? 0,
    vulnerabilitiesCount: deviceJSON.vulnerabilities_count ?? null,
    servicesCount: deviceJSON.services_count ?? null,
    lastSeen: deviceJSON.last_seen,
  }
}

const columns: TableColumn<Device>[] = [
  {
    key: "status",
    label: "Status",
    display: { kind: "status", activeValues: ["up"] },
    filter: { kind: "status", options: ["up", "down"] },
  },
  { key: "hostname", label: "Device", sortable: true, filter: { kind: "text" } },
  { key: "vendor", label: "Vendor", sortable: true, filter: { kind: "text" } },
  { key: "ip", label: "IP", filter: { kind: "text" } },
  { key: "mac", label: "MAC address", filter: { kind: "text" } },
  {
    key: "riskScore",
    label: "Score",
    sortable: true,
    display: { kind: "risk-score" },
    filter: { kind: "number" },
  },
  { key: "vulnerabilitiesCount", label: "Issues", sortable: true, filter: { kind: "number" } },
  { key: "servicesCount", label: "Services", sortable: true, filter: { kind: "number" } },
  {
    key: "lastSeen",
    label: "Last seen",
    sortable: true,
    display: { kind: "date" },
    filter: { kind: "date" },
  },
]

function Devices() {
  const { scanGeneration } = useSystemStatus()
  const { data, loading, error } = useApiResource(fetchDevices, scanGeneration)
  const rows = useMemo(() => (data ?? []).map(toDevice), [data])

  const table = useTableState({
    rows,
    columns,
    storageKey: TABLE_STORAGE_KEYS.DEVICES,
  })

  return (
    <div className="devices-tab">
      <TableFilter
        columns={columns}
        filters={table.filters}
        onAddFilter={table.addFilter}
        onRemoveFilter={table.removeFilter}
        onClearFilters={table.clearFilters}
      />
      {
        loading ?
        <TableData
          status="loading"
          columns={columns}
        />
        : error && !data ?
        <TableData
          status="error"
          columns={columns}
          message={error}
        />
        :
        <TableData
          status="ready"
          rows={table.rows}
          columns={columns}
          getRowKey={(device) => device.id}
          sort={table.sort}
          onSortChange={table.changeSort}
        />
      }
    </div>
  )
}

export default Devices
