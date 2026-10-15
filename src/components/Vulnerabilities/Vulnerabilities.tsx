import "./Vulnerabilities.css"
import TableFilter from "../TableFilter/TableFilter"
import TableData from "../TableData/TableData"
import { useTableState } from "../TableData/useTableState"
import type { TableColumn } from "../TableData/TableTypes"
import { useEffect, useState } from "react"
import VulnerabilityPanel from "../VulnerabilityPanel/VulnerabilityPanel"

interface VulnerabilityJSON{
  id: number,
  device_id: number,
  device_ip: string,
  cve_id: string,
  severity: string,
  cvss_score: number,
  description: string,
  reference_url: string,
  detected_at: string
}

// TODO: it would be great if device name/hostname would be also included
interface Vulnerability {
  id: number
  device_id: number
  device_ip: string
  cve_id: string
  score: number
  reference_url: string
  detected_at: string
}

function toVulnerability(vulnerabilityJSON: VulnerabilityJSON): Vulnerability{
  return {
    id: vulnerabilityJSON.id,
    device_id: vulnerabilityJSON.device_id,
    device_ip: vulnerabilityJSON.device_ip,
    cve_id: vulnerabilityJSON.cve_id,
    score: vulnerabilityJSON.cvss_score,
    reference_url: vulnerabilityJSON.reference_url,
    detected_at: vulnerabilityJSON.detected_at,
  }
}

const columns: TableColumn<Vulnerability>[] = [
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
    label: "Dected at",
    sortable: true,
    display: { kind: "date" },
    filter: { kind: "date" },
  },
]

async function getVulnerabilities(signal?: AbortSignal): Promise<VulnerabilityJSON[]>{
  const response = await fetch("/api/vulnerabilities", {
    method: "GET",
    signal, 
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  })

  if (!response.ok) {
    throw new Error(`Could not load vulnerabilities (HTTP ${response.status})`)
  }

  const body: unknown = await response.json()
  if (
    typeof body !== "object" ||
    body === null ||
    !("vulnerabilities" in body) ||
    !Array.isArray(body.vulnerabilities)
  ) {
    throw new Error("The vulnerabilities API returned an invalid response")
  }
  
  return body.vulnerabilities as VulnerabilityJSON[]
}

function Vulnerabilities() {
  const [vulnerabilities, setVulnerabilities] = useState<VulnerabilityJSON[]>([])
  const [selectedVulnerability, setSelectedVulnerability] = useState<Vulnerability | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    getVulnerabilities(controller.signal)
      .then(setVulnerabilities)
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return
        setError(error instanceof Error ? error.message : "Could not load vulnerabilities")
      })
      .finally(() => setLoading(false))

      return () => controller.abort()
  }, [])

  const table = useTableState({
    rows: vulnerabilities.map(toVulnerability),
    columns,
    storageKey: "pigeons-are-drones:vulnerabilities-table:v1",
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
            : error
              ? { status: "error" as const, message: error }
              : {
                  status: "ready" as const,
                  rows: table.rows,
                  getRowKey: (vuln: Vulnerability) => vuln.id,
                  sort: table.sort,
                  onSortChange: table.changeSort,
                  onRowClick: setSelectedVulnerability,
                  selectedRowKey: selectedVulnerability?.id,
                })}
          columns={columns}
        />
      </div>
      <div className="vulnerabilities-tab__column">
        <VulnerabilityPanel
          cveId={selectedVulnerability?.cve_id ?? null}
          score={selectedVulnerability?.score ?? null}
        />
      </div>
    </div>
  )
}

export default Vulnerabilities