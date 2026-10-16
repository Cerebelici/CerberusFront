import { useMemo } from 'react'
import TableData from '../TableData/TableData'
import TableFilter from '../TableFilter/TableFilter'
import type { TableColumn } from '../TableData/TableTypes'
import { useTableState } from '../TableData/useTableState'
import { TABLE_STORAGE_KEYS } from '../../constants'
import type { ScanLogDTO, ScanLogStatus, ScanLogType } from './scanTypes'

interface ScanRow {
  id: number
  status: ScanLogStatus
  scanType: ScanLogType
  target: string
  hostsFound: number
  vulnsFound: number
  durationMs: number
  startedAt: string
  error: string | null
}

function toScanRow(scan: ScanLogDTO): ScanRow {
  return {
    id: scan.id,
    status: scan.status,
    scanType: scan.scan_type,
    target: scan.target_spec,
    hostsFound: scan.hosts_found,
    vulnsFound: scan.vulns_found,
    durationMs: scan.duration_ms,
    startedAt: scan.started_at,
    error: scan.error_message || null,
  }
}

const columns: TableColumn<ScanRow>[] = [
  { key: 'id', label: 'ID', sortable: true, filter: { kind: 'number' } },
  { key: 'status', label: 'Result', sortable: true, filter: { kind: 'text' } },
  { key: 'scanType', label: 'Type', sortable: true, filter: { kind: 'text' } },
  { key: 'target', label: 'Target', filter: { kind: 'text' } },
  { key: 'hostsFound', label: 'Hosts', sortable: true, filter: { kind: 'number' } },
  { key: 'vulnsFound', label: 'Vulns', sortable: true, filter: { kind: 'number' } },
  { key: 'durationMs', label: 'Duration (ms)', sortable: true, filter: { kind: 'number' } },
  { key: 'startedAt', label: 'Started at', sortable: true, display: { kind: 'date' }, filter: { kind: 'date' } },
  { key: 'error', label: 'Error', filter: { kind: 'text' } },
]

interface ScanHistoryTableProps {
  scans: readonly ScanLogDTO[] | null
  loading: boolean
  error: string | null
}

function ScanHistoryTable({ scans, loading, error }: ScanHistoryTableProps) {
  const rows = useMemo(() => (scans ?? []).map(toScanRow), [scans])
  const table = useTableState({ rows, columns, storageKey: TABLE_STORAGE_KEYS.SCANS })

  return (
    <section className="scan-history" aria-label="Scan history">
      <h2 className="scan-history__title">Scan history</h2>
      <TableFilter
        columns={columns}
        filters={table.filters}
        onAddFilter={table.addFilter}
        onRemoveFilter={table.removeFilter}
        onClearFilters={table.clearFilters}
      />
      <TableData
        {...(loading
          ? { status: 'loading' as const }
          : error && !scans
            ? { status: 'error' as const, message: error }
            : {
                status: 'ready' as const,
                rows: table.rows,
                getRowKey: (row: ScanRow) => row.id,
                sort: table.sort,
                onSortChange: table.changeSort,
              })}
        columns={columns}
      />
    </section>
  )
}

export default ScanHistoryTable
