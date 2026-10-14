import "./Devices.css"
import TableFilter from "../TableFilter/TableFilter"
import TableData from "../TableData/TableData"
import { useTableState } from "../TableData/useTableState"
import type { TableColumn } from "../TableData/TableTypes"
import { useEffect, useState } from "react"

interface DeviceJSON{
  id: number
  current_ip: string
  ip?: string
  mac?: string
  hostname?: string
  vendor?: string
  status: "up" | "down"
  first_seen: string
  last_seen: string
  services_count?: number
  vulnerabilities_count?: number
}

interface Device {
  id: number
  hostname: string | null
  vendor: string | null
  ip: string
  mac: string | null
  status: "up" | "down"
  riskScore: number | null
  vulnerabilitiesCount: number | null
  servicesCount: number | null
  lastSeen: string
}

function toDevice(deviceJSON: DeviceJSON): Device{
  return {
    id: deviceJSON.id,
    hostname: deviceJSON.hostname ?? null, 
    vendor: deviceJSON.vendor ?? null,
    ip: deviceJSON.current_ip,
    mac: deviceJSON.mac ?? null,
    status: deviceJSON.status,
    riskScore: Math.random() * 10.0, //Placeholder !!! TODO
    vulnerabilitiesCount: deviceJSON.vulnerabilities_count ?? null,
    servicesCount: deviceJSON.services_count ?? null,
    lastSeen: deviceJSON.last_seen,
  }
}

// const devices: Device[] = devicesMock.data.map((device) => {
//   if (device.status !== "up" && device.status !== "down") {
//     throw new Error(`Unsupported device status: ${device.status}`)
//   }

//   return { ...device, status: device.status }
// })

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

async function getDevices(signal?: AbortSignal): Promise<DeviceJSON[]>{
  const response = await fetch("/api/devices", {
    method: "GET",
    signal, 
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  })

  if (!response.ok) {
    throw new Error(`Could not load devices (HTTP ${response.status})`)
  }

  const body: unknown = await response.json()
  if (
    typeof body !== "object" ||
    body === null ||
    !("devices" in body) ||
    !Array.isArray(body.devices)
  ) {
    throw new Error("The devices API returned an invalid response")
  }
  
  return body.devices as DeviceJSON[]
}

function Devices() {
  const [devices, setDevices] = useState<DeviceJSON[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    getDevices(controller.signal)
      .then(setDevices)
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return
        setError(error instanceof Error ? error.message : "Could not load devices")
      })
      .finally(() => setLoading(false))

      return () => controller.abort()
  }, [])

  const table = useTableState({
    rows: devices.map(toDevice),
    columns,
    storageKey: "pigeons-are-drones:devices-table:v1",
  })

  // temp
  if (loading) return <p>Loading devices…</p>
  if (error) return <p role="alert">{error}</p>
  // ----

  return (
    <div className="devices-tab">
      <TableFilter
        columns={columns}
        filters={table.filters}
        onAddFilter={table.addFilter}
        onRemoveFilter={table.removeFilter}
        onClearFilters={table.clearFilters}
      />
      <TableData
        rows={table.rows}
        columns={columns}
        getRowKey={(device) => device.id}
        sort={table.sort}
        onSortChange={table.changeSort}
      />
    </div>
  )
}

export default Devices
