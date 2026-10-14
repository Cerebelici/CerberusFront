import "./Services.css"
import TableFilter from "../TableFilter/TableFilter"
import TableData from "../TableData/TableData"
import { useTableState } from "../TableData/useTableState"
import type { TableColumn } from "../TableData/TableTypes"
import { useEffect, useState } from "react"

interface ServiceJSON{
  id: number,
  device_id: number,
  device_ip: string,
  port: number,
  protocol: string,
  service_name: string,
  product?: string,
  version?: string,
  state: "open"|"closed",
  updated_at: string
}

interface Service {
  id: number,
  deviceId: number,
  deviceIp: string,
  port: number,
  protocol: string,
  serviceName: string,
  product: string | null,
  version: string | null,
  state: "open"|"closed",
  updatedAt: string
}

function toService(serviceJSON: ServiceJSON): Service{
  return {
    id: serviceJSON.id,
    deviceId: serviceJSON.device_id,
    deviceIp: serviceJSON.device_ip,
    port: serviceJSON.port,
    protocol: serviceJSON.protocol,
    serviceName: serviceJSON.service_name,
    product: serviceJSON.product ?? null,
    version: serviceJSON.version ?? null,
    state: serviceJSON.state,
    updatedAt: serviceJSON.updated_at,
  }
}

// const devices: Device[] = devicesMock.data.map((device) => {
//   if (device.status !== "up" && device.status !== "down") {
//     throw new Error(`Unsupported device status: ${device.status}`)
//   }

//   return { ...device, status: device.status }
// })

const columns: TableColumn<Service>[] = [
  {
    key: "state",
    label: "Status",
    display: { kind: "status", activeValues: ["open"] },
    filter: { kind: "status", options: ["open", "closed"] },
  },
  { key: "deviceIp", label: "Device", filter: { kind: "text" } },
  { key: "port", label: "Port", sortable: true, filter: { kind: "number" } },
  { key: "protocol", label: "Protocol", sortable: true, filter: { kind: "text" } },
  { key: "serviceName", label: "Service", filter: { kind: "text" } },
  { key: "product", label: "Product", sortable: true, filter: { kind: "text" } },
  { key: "version", label: "Version", sortable: true, filter: { kind: "text" } },
  {
    key: "updatedAt",
    label: "Updated at",
    sortable: true,
    display: { kind: "date" },
    filter: { kind: "date" },
  },
]

async function getServices(signal?: AbortSignal): Promise<ServiceJSON[]>{
  const response = await fetch("/api/services", {
    method: "GET",
    signal, 
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  })

  if (!response.ok) {
    throw new Error(`Could not load services (HTTP ${response.status})`)
  }

  const body: unknown = await response.json()
  if (
    typeof body !== "object" ||
    body === null ||
    !("services" in body) ||
    !Array.isArray(body.services)
  ) {
    throw new Error("The services API returned an invalid response")
  }
  
  return body.services as ServiceJSON[]
}

function Services() {
  const [services, setServices] = useState<ServiceJSON[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    getServices(controller.signal)
      .then(setServices)
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return
        setError(error instanceof Error ? error.message : "Could not load services")
      })
      .finally(() => setLoading(false))

      return () => controller.abort()
  }, [])

  const table = useTableState({
    rows: services.map(toService),
    columns,
    storageKey: "pigeons-are-drones:services-table:v1",
  })

  // temp
  if (loading) return <p>Loading services</p>
  if (error) return <p role="alert">{error}</p>
  // ----

  return (
    <div className="services-tab">
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
        getRowKey={(service) => service.id}
        sort={table.sort}
        onSortChange={table.changeSort}
      />
    </div>
  )
}

export default Services