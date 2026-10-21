import { useMemo, useState } from 'react'
import TableData from '../TableData/TableData'
import TableFilter from '../TableFilter/TableFilter'
import type { TableColumn } from '../TableData/TableTypes'
import { useTableState } from '../TableData/useTableState'
import { TABLE_STORAGE_KEYS } from '../../constants'
import type { ScanLogDTO, ScanLogStatus, ScanLogType } from './scanTypes'
import { Icon } from '../Icon/Icon'
import { ConfirmModal } from '../ConfirmModal/ConfirmModal'
import { clearScanHistory } from '../../api/inventory'

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
  onCleared?: () => void
}

function ScanHistoryTable({ scans, loading, error, onCleared }: ScanHistoryTableProps) {
  const rows = useMemo(() => (scans ?? []).map(toScanRow), [scans])
  const table = useTableState({ rows, columns, storageKey: TABLE_STORAGE_KEYS.SCANS })

  const [isClearModalOpen, setIsClearModalOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const handleConfirmClear = async () => {
    try {
      setIsProcessing(true)
      setActionError(null)
      await clearScanHistory()
      setIsClearModalOpen(false)
      onCleared?.()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to clear scan history')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <section className="scan-history" aria-label="Scan history">
      <div className="scan-history-header">
        <div className="scan-history-stats">
          <span>Execution History:</span>
          <span className="scan-history-count">{rows.length} {rows.length === 1 ? 'Run' : 'Runs'}</span>
        </div>
        <button
          type="button"
          className="btn btn--dark scan-clear-all-btn"
          disabled={rows.length === 0 || loading || isProcessing}
          onClick={() => {
            setActionError(null)
            setIsClearModalOpen(true)
          }}
          title="Clear all past scan execution records from database"
        >
          <Icon name="delete" />
          <span>Clear Scan History</span>
        </button>
      </div>

      {actionError && (
        <div className="scan-action-error" role="alert">
          <Icon name="report" />
          <span>{actionError}</span>
        </div>
      )}

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

      <ConfirmModal
        isOpen={isClearModalOpen}
        title="Clear Scan Execution History?"
        message={`Are you sure you want to permanently delete all ${rows.length} scan logs?`}
        subMessage="Discovered devices, services, and vulnerability findings will remain untouched."
        confirmLabel="Clear Scan History"
        loading={isProcessing}
        onConfirm={handleConfirmClear}
        onCancel={() => !isProcessing && setIsClearModalOpen(false)}
      />
    </section>
  )
}

export default ScanHistoryTable
