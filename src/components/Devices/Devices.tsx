import "./Devices.css"
import TableFilter from "../TableFilter/TableFilter"
import TableData from "../TableData/TableData"
import { useTableState } from "../TableData/useTableState"
import type { TableColumn } from "../TableData/TableTypes"
import { useMemo, useState } from "react"
import { fetchDevices, deleteDevice, clearAllDevices } from "../../api/inventory"
import type { DeviceDTO, DeviceStatus } from "../../api/types"
import { useApiResource } from "../../hooks/useApiResource"
import { useSystemStatus } from "../../state/useSystemStatus"
import { TABLE_STORAGE_KEYS } from "../../constants"
import { Icon } from "../Icon/Icon"
import { ConfirmModal } from "../ConfirmModal/ConfirmModal"

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
  actions?: unknown
}

function toDevice(deviceJSON: DeviceDTO): Device {
  return {
    id: deviceJSON.id,
    // An operator-assigned label wins over the scanned hostname.
    hostname: deviceJSON.label || deviceJSON.hostname || null,
    vendor: deviceJSON.vendor ?? null,
    ip: deviceJSON.current_ip || deviceJSON.ip || "",
    mac: deviceJSON.mac ?? null,
    status: deviceJSON.status,
    // Host risk R_h (0–10) from the posture engine; the backend omits it when 0.
    riskScore: typeof deviceJSON.risk === "number" ? deviceJSON.risk : 0,
    vulnerabilitiesCount: deviceJSON.vulnerabilities_count ?? 0,
    servicesCount: deviceJSON.services_count ?? 0,
    lastSeen: deviceJSON.last_seen,
  }
}

function Devices() {
  const { scanGeneration, refresh } = useSystemStatus()
  const { data, loading, error, reload, setData } = useApiResource(fetchDevices, scanGeneration)
  const rows = useMemo(() => (data ?? []).map(toDevice), [data])

  const [deviceToDelete, setDeviceToDelete] = useState<Device | null>(null)
  const [isClearAllOpen, setIsClearAllOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const columns: TableColumn<Device>[] = useMemo(
    () => [
      {
        key: "status",
        label: "Status",
        size: "content",
        display: { kind: "status", activeValues: ["up"] },
        filter: { kind: "status", options: ["up", "down"] },
      },
      { key: "hostname", label: "Device", sortable: true, filter: { kind: "text" } },
      { key: "vendor", label: "Vendor", sortable: true, filter: { kind: "text" } },
      { key: "ip", label: "IP", size: "content", filter: { kind: "text" } },
      { key: "mac", label: "MAC address", filter: { kind: "text" } },
      {
        key: "riskScore",
        label: "Score",
        size: "content",
        sortable: true,
        display: { kind: "risk-score" },
        filter: { kind: "number" },
      },
      { key: "vulnerabilitiesCount", label: "Issues", size: "content", sortable: true, filter: { kind: "number" } },
      { key: "servicesCount", label: "Services", size: "content", sortable: true, filter: { kind: "number" } },
      {
        key: "lastSeen",
        label: "Last seen",
        size: "content",
        sortable: true,
        display: { kind: "date" },
        filter: { kind: "date" },
      },
      {
        key: "actions",
        label: "Action",
        size: "content",
        render: (_, device) => (
          <button
            type="button"
            className="device-delete-row-btn"
            title={`Delete device ${device.ip}`}
            aria-label={`Delete device ${device.ip}`}
            onClick={(e) => {
              e.stopPropagation()
              setActionError(null)
              setDeviceToDelete(device)
            }}
          >
            <Icon name="delete" />
          </button>
        ),
      },
    ],
    []
  )

  const table = useTableState({
    rows,
    columns,
    storageKey: TABLE_STORAGE_KEYS.DEVICES,
  })

  const handleConfirmDeleteDevice = async () => {
    if (!deviceToDelete) return
    const target = deviceToDelete
    // Optimistic removal: instantly close modal and remove record from table
    setDeviceToDelete(null)
    setActionError(null)
    setData((current) => (current ? current.filter((d) => d.id !== target.id) : current))

    try {
      setIsProcessing(true)
      await deleteDevice(target.id)
      refresh()
    } catch (err) {
      // Rollback on failure
      reload()
      setActionError(err instanceof Error ? err.message : "Failed to delete device")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleConfirmClearAll = async () => {
    // Optimistic removal: instantly close modal and clear all records from table
    setIsClearAllOpen(false)
    setActionError(null)
    setData([])

    try {
      setIsProcessing(true)
      await clearAllDevices()
      refresh()
    } catch (err) {
      // Rollback on failure
      reload()
      setActionError(err instanceof Error ? err.message : "Failed to clear all devices")
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="devices-tab">
      <div className="devices-header">
        <div className="devices-stats">
          <span>Active Subnet Inventory:</span>
          <span className="devices-stats-count">{rows.length} {rows.length === 1 ? 'Device' : 'Devices'}</span>
        </div>
        <button
          type="button"
          className="btn btn--dark devices-clear-all-btn"
          disabled={rows.length === 0 || loading || isProcessing}
          onClick={() => {
            setActionError(null)
            setIsClearAllOpen(true)
          }}
          title="Clear all devices from database (e.g. when changing networks)"
        >
          <Icon name="delete" />
          <span>Clear All Devices</span>
        </button>
      </div>

      {actionError && (
        <div className="devices-action-error" role="alert">
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
          emptyMessage={
            table.filters.length > 0
              ? "No devices match the active filters."
              : "No devices found yet. Discovery scans the network at start and then on its schedule."
          }
          columns={columns}
          getRowKey={(device) => device.id}
          sort={table.sort}
          onSortChange={table.changeSort}
        />
      }

      {/* Confirm Single Device Deletion Modal */}
      <ConfirmModal
        isOpen={Boolean(deviceToDelete)}
        title="Delete Device"
        message={`Are you sure you want to delete "${deviceToDelete?.hostname || deviceToDelete?.ip}" (${deviceToDelete?.ip})?`}
        subMessage={`This will permanently remove this device, its ${deviceToDelete?.servicesCount ?? 0} open services, and its ${deviceToDelete?.vulnerabilitiesCount ?? 0} vulnerability findings. Scan execution history will remain intact.`}
        confirmLabel="Delete Device"
        loading={isProcessing}
        onConfirm={handleConfirmDeleteDevice}
        onCancel={() => !isProcessing && setDeviceToDelete(null)}
      />

      {/* Confirm Clear All Devices Modal */}
      <ConfirmModal
        isOpen={isClearAllOpen}
        title="Clear All Discovered Devices?"
        message={`This will permanently delete all ${rows.length} tracked devices and their associated open ports, services, and vulnerability findings.`}
        subMessage="Use this when moving to a new network to start a fresh scan. Past scan logs and application configuration settings will be preserved."
        confirmLabel="Clear All Devices"
        loading={isProcessing}
        onConfirm={handleConfirmClearAll}
        onCancel={() => !isProcessing && setIsClearAllOpen(false)}
      />
    </div>
  )
}

export default Devices
