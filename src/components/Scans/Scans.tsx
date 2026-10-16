import "./Scans.css"
import TableFilter from "../TableFilter/TableFilter"
import TableData from "../TableData/TableData"
import { useTableState } from "../TableData/useTableState"
import type { TableColumn } from "../TableData/TableTypes"
import { useEffect, useState, useCallback } from "react"

interface ScanJSON {
  id: number
  scan_type: string
  status: string
  target_spec: string
  hosts_found: number
  vulns_found?: number
  duration_ms: number
  started_at: string
  completed_at?: string
}

interface Scan {
  id: number
  scanType: string
  status: string
  targetSpec: string
  hostsFound: number
  vulnsFound: number
  durationMs: number
  startedAt: string
  completedAt: string | null
}

function toScan(scanJSON: ScanJSON): Scan {
  return {
    id: scanJSON.id,
    scanType: scanJSON.scan_type,
    status: scanJSON.status,
    targetSpec: scanJSON.target_spec,
    hostsFound: scanJSON.hosts_found ?? 0,
    vulnsFound: scanJSON.vulns_found ?? 0,
    durationMs: scanJSON.duration_ms ?? 0,
    startedAt: scanJSON.started_at,
    completedAt: scanJSON.completed_at ?? null,
  }
}

const columns: TableColumn<Scan>[] = [
  {
    key: "status",
    label: "Status",
    display: { kind: "status", activeValues: ["completed", "running"] },
    filter: { kind: "status", options: ["completed", "running", "failed"] },
  },
  { key: "id", label: "Scan ID", sortable: true, filter: { kind: "number" } },
  { key: "scanType", label: "Type", sortable: true, filter: { kind: "text" } },
  { key: "targetSpec", label: "Target", filter: { kind: "text" } },
  { key: "hostsFound", label: "Hosts", sortable: true, filter: { kind: "number" } },
  { key: "vulnsFound", label: "Issues", sortable: true, filter: { kind: "number" } },
  { key: "durationMs", label: "Duration (ms)", sortable: true, filter: { kind: "number" } },
  {
    key: "startedAt",
    label: "Started At",
    sortable: true,
    display: { kind: "date" },
    filter: { kind: "date" },
  },
  {
    key: "completedAt",
    label: "Completed At",
    sortable: true,
    display: { kind: "date" },
    filter: { kind: "date" },
  },
]

async function getScans(signal?: AbortSignal): Promise<ScanJSON[]> {
  const response = await fetch("/api/scans", {
    method: "GET",
    signal,
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  })

  if (!response.ok) {
    throw new Error(`Could not load scans (HTTP ${response.status})`)
  }

  const body: unknown = await response.json()
  if (
    typeof body !== "object" ||
    body === null ||
    !("scans" in body) ||
    !Array.isArray(body.scans)
  ) {
    throw new Error("The scans API returned an invalid response")
  }

  return body.scans as ScanJSON[]
}

function Scans() {
  const [scans, setScans] = useState<ScanJSON[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [triggerStatus, setTriggerStatus] = useState<string | null>(null)
  const [isTriggering, setIsTriggering] = useState(false)

  const refreshScans = useCallback(() => {
    getScans()
      .then(setScans)
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return
        setError(err instanceof Error ? err.message : "Could not load scans")
      })
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    getScans(controller.signal)
      .then(setScans)
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return
        setError(err instanceof Error ? err.message : "Could not load scans")
      })
      .finally(() => setLoading(false))

    const intervalId = window.setInterval(() => {
      getScans(controller.signal)
        .then(setScans)
        .catch(() => {})
    }, 15_000)

    return () => {
      controller.abort()
      window.clearInterval(intervalId)
    }
  }, [])

  const handleTriggerScan = async (type: "discovery" | "vulnerability") => {
    setIsTriggering(true)
    setTriggerStatus(`Triggering ${type} scan...`)
    try {
      const response = await fetch(`/api/scans/${type}/trigger`, {
        method: "POST",
        headers: { Accept: "application/json" },
      })
      if (!response.ok) {
        throw new Error(`Failed to trigger scan: HTTP ${response.status}`)
      }
      const data = await response.json()
      setTriggerStatus(data.message || `${type} scan triggered successfully.`)
      setTimeout(refreshScans, 1000)
    } catch (err: unknown) {
      setTriggerStatus(err instanceof Error ? err.message : "Failed to trigger scan")
    } finally {
      setIsTriggering(false)
      setTimeout(() => setTriggerStatus(null), 5000)
    }
  }

  const table = useTableState({
    rows: scans.map(toScan),
    columns,
    storageKey: "pigeons-are-drones:scans-table:v1",
  })

  return (
    <div className="scans-tab">
      <div className="scans-actions">
        <div className="scans-actions__buttons">
          <button
            className="btn btn--light scans-trigger-btn"
            disabled={isTriggering}
            onClick={() => void handleTriggerScan("discovery")}
          >
            Trigger Discovery Scan
          </button>
          <button
            className="btn btn--light scans-trigger-btn"
            disabled={isTriggering}
            onClick={() => void handleTriggerScan("vulnerability")}
          >
            Trigger Vulnerability Scan
          </button>
        </div>
        {triggerStatus && <span className="scans-actions__status">{triggerStatus}</span>}
      </div>

      <TableFilter
        columns={columns}
        filters={table.filters}
        onAddFilter={table.addFilter}
        onRemoveFilter={table.removeFilter}
        onClearFilters={table.clearFilters}
      />

      {loading ? (
        <TableData status="loading" columns={columns} />
      ) : error ? (
        <TableData status="error" columns={columns} message={error} />
      ) : (
        <TableData
          status="ready"
          rows={table.rows}
          columns={columns}
          getRowKey={(scan) => scan.id}
          sort={table.sort}
          onSortChange={table.changeSort}
        />
      )}
    </div>
  )
}

export default Scans
