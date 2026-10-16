import "./Services.css"
import TableFilter from "../TableFilter/TableFilter"
import TableData from "../TableData/TableData"
import { useTableState } from "../TableData/useTableState"
import type { TableColumn } from "../TableData/TableTypes"
import { useMemo } from "react"
import { fetchServices } from "../../api/inventory"
import type { ServiceDTO, ServiceState } from "../../api/types"
import { useApiResource } from "../../hooks/useApiResource"
import { useSystemStatus } from "../../state/useSystemStatus"
import { TABLE_STORAGE_KEYS } from "../../constants"

interface Service {
  id: number,
  deviceId: number,
  deviceIp: string | null,
  port: number,
  protocol: string,
  serviceName: string | null,
  product: string | null,
  version: string | null,
  state: ServiceState,
  updatedAt: string
}

function toService(serviceJSON: ServiceDTO): Service{
  return {
    id: serviceJSON.id,
    deviceId: serviceJSON.device_id,
    deviceIp: serviceJSON.device_ip ?? null,
    port: serviceJSON.port,
    protocol: serviceJSON.protocol,
    serviceName: serviceJSON.service_name ?? null,
    product: serviceJSON.product ?? null,
    version: serviceJSON.version ?? null,
    state: serviceJSON.state,
    updatedAt: serviceJSON.updated_at,
  }
}

const columns: TableColumn<Service>[] = [
  {
    key: "state",
    label: "Status",
    display: { kind: "status", activeValues: ["open"] },
    filter: { kind: "status", options: ["open", "filtered", "closed"] },
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

function Services() {
  const { scanGeneration } = useSystemStatus()
  const { data, loading, error } = useApiResource(fetchServices, scanGeneration)
  const rows = useMemo(() => (data ?? []).map(toService), [data])

  const table = useTableState({
    rows,
    columns,
    storageKey: TABLE_STORAGE_KEYS.SERVICES,
  })

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
        {...(loading
          ? { status: "loading" as const }
          : error && !data
            ? { status: "error" as const, message: error }
            : {
                status: "ready" as const,
                rows: table.rows,
                getRowKey: (service: Service) => service.id,
                sort: table.sort,
                onSortChange: table.changeSort,
              })}
        columns={columns}
      />
    </div>
  )
}

export default Services
