import "./Vulnerabilities.css"
import TableFilter from "../TableFilter/TableFilter"
import TableData from "../TableData/TableData"
import { useTableState } from "../TableData/useTableState"
import type { TableColumn } from "../TableData/TableTypes"
import { useMemo, useState } from "react"
import VulnerabilityPanel, { type VulnerabilityDetails } from "../VulnerabilityPanel/VulnerabilityPanel"
import { fetchVulnerabilities } from "../../api/inventory"
import type { VulnerabilityDTO, VulnerabilityStatus } from "../../api/types"
import { useApiResource } from "../../hooks/useApiResource"
import { useSystemStatus } from "../../state/useSystemStatus"
import { TABLE_STORAGE_KEYS } from "../../constants"

// TODO: it would be great if device name/hostname would be also included
interface Vulnerability extends VulnerabilityDetails {
  id: number
  device_id: number
  device_ip: string | null
  cve_id: string
  score: number
  status: VulnerabilityStatus
  detected_at: string
}

function toVulnerability(vulnerabilityJSON: VulnerabilityDTO): Vulnerability{
  return {
    id: vulnerabilityJSON.id,
    device_id: vulnerabilityJSON.device_id,
    device_ip: vulnerabilityJSON.device_ip ?? null,
    port: vulnerabilityJSON.service_port,
    cve_id: vulnerabilityJSON.cve_id,
    title: vulnerabilityJSON.title ?? null,
    severity: vulnerabilityJSON.severity,
    score: vulnerabilityJSON.cvss_score,
    description: vulnerabilityJSON.description ?? null,
    reference_url: vulnerabilityJSON.reference_url ?? null,
    status: vulnerabilityJSON.status,
    detected_at: vulnerabilityJSON.detected_at,
  }
}

const columns: TableColumn<Vulnerability>[] = [
  {
    key: "status",
    label: "Status",
    display: { kind: "status", activeValues: ["open"] },
    filter: { kind: "status", options: ["open", "resolved"] },
  },
  { key: "device_ip", label: "Device", filter: { kind: "text" } },
  { key: "cve_id", label: "CVE ID", sortable: true, filter: { kind: "text" } },
  {
    key: "score",
    label: "Score",
    sortable: true,
    display: { kind: "risk-score" },
    filter: { kind: "number" },
  },
  {
    key: "detected_at",
    label: "Detected at",
    sortable: true,
    display: { kind: "date" },
    filter: { kind: "date" },
  },
]

function Vulnerabilities() {
  const { scanGeneration } = useSystemStatus()
  const { data, loading, error } = useApiResource(fetchVulnerabilities, scanGeneration)
  const rows = useMemo(() => (data ?? []).map(toVulnerability), [data])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  // Derive the selection from fresh data so the panel never shows a stale row after a refresh.
  const selectedVulnerability = rows.find((row) => row.id === selectedId) ?? null

  const table = useTableState({
    rows,
    columns,
    storageKey: TABLE_STORAGE_KEYS.VULNERABILITIES,
  })

  return (
    <div className="vulnerabilities-tab">
      <div className="vulnerabilities-tab__column vulnerabilities-tab__column--table">
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
                  getRowKey: (vuln: Vulnerability) => vuln.id,
                  sort: table.sort,
                  onSortChange: table.changeSort,
                  onRowClick: (vuln: Vulnerability) => setSelectedId(vuln.id),
                  selectedRowKey: selectedVulnerability?.id,
                })}
          columns={columns}
        />
      </div>
      <div className="vulnerabilities-tab__column">
        <VulnerabilityPanel vulnerability={selectedVulnerability} />
      </div>
    </div>
  )
}

export default Vulnerabilities
