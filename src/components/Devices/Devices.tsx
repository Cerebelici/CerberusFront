import { useEffect, useMemo, useState } from "react"
import "./Devices.css"
import TableFilter from "../TableFilter/TableFilter"
import TableData from "../TableData/TableData"
import type { TableColumn, TableFilterRule, TableSort } from "../TableData/TableData"

import devicesMock from "../../../devices_mock.json"

interface Device {
  deviceName: string
  vendor: string
  ipAddress: string
  macAddress: string
  status: "online" | "offline"
  riskScore: number
  issuesCount: number
  servicesCount: number
  lastSeen: string
}

const devices: Device[] = devicesMock.data.map((device) => {
  if (device.status !== "online" && device.status !== "offline") {
    throw new Error(`Unsupported device status: ${device.status}`)
  }

  return { ...device, status: device.status }
})

const columns: TableColumn<Device>[] = [
  {
    key: "status",
    label: "Status",
    display: { kind: "status", activeValues: ["online"] },
    filter: { kind: "status", options: ["online", "offline"] },
  },
  { key: "deviceName", label: "Device", sortable: true, filter: { kind: "text" } },
  { key: "vendor", label: "Vendor", sortable: true, filter: { kind: "text" } },
  { key: "ipAddress", label: "IP", filter: { kind: "text" } },
  { key: "macAddress", label: "MAC address", filter: { kind: "text" } },
  {
    key: "riskScore",
    label: "Score",
    sortable: true,
    display: { kind: "risk-score" },
    filter: { kind: "number" },
  },
  { key: "issuesCount", label: "Issues", sortable: true, filter: { kind: "number" } },
  { key: "servicesCount", label: "Services", sortable: true, filter: { kind: "number" } },
  {
    key: "lastSeen",
    label: "Last seen",
    sortable: true,
    display: { kind: "date" },
    filter: { kind: "date" },
  },
]

interface DeviceTableState {
  filters: TableFilterRule<Device>[]
  sort: TableSort<Device> | null
}

const STORAGE_KEY = "pigeons-are-drones:devices-table:v1"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isDateValue(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
}

function parseFilterRule(value: unknown): TableFilterRule<Device> | null {
  if (!isRecord(value) || typeof value.columnKey !== "string" || typeof value.value !== "string") {
    return null
  }

  const column = columns.find((candidate) => String(candidate.key) === value.columnKey)
  if (!column?.filter) return null

  switch (column.filter.kind) {
    case "status":
      return column.filter.options.includes(value.value)
        ? { columnKey: column.key, kind: "status", value: value.value }
        : null
    case "text":
      if (value.operator === "equal" || value.operator === "contains") {
        return value.value.trim()
          ? { columnKey: column.key, kind: "text", operator: value.operator, value: value.value }
          : null
      }
      return null
    case "number": {
      if (
        value.operator !== "equal" &&
        value.operator !== "lt" &&
        value.operator !== "gt" &&
        value.operator !== "ltq" &&
        value.operator !== "gtq" &&
        value.operator !== "range"
      ) return null
      if (!value.value || !Number.isFinite(Number(value.value))) return null
      const numberSecondValue = value.secondValue
      if (
        value.operator === "range" &&
        (typeof numberSecondValue !== "string" || !Number.isFinite(Number(numberSecondValue)))
      ) return null
      return {
        columnKey: column.key,
        kind: "number",
        operator: value.operator,
        value: value.value,
        ...(value.operator === "range" && typeof numberSecondValue === "string"
          ? { secondValue: numberSecondValue }
          : {}),
      }
    }
    case "date":
      if (value.operator !== "before" && value.operator !== "after" && value.operator !== "range") {
        return null
      }
      if (!isDateValue(value.value)) return null
      if (value.operator === "range" && (
        typeof value.secondValue !== "string" ||
        !isDateValue(value.secondValue) ||
        value.value > value.secondValue
      )) return null
      return {
        columnKey: column.key,
        kind: "date",
        operator: value.operator,
        value: value.value,
        ...(value.operator === "range" ? { secondValue: value.secondValue as string } : {}),
      }
  }
}

function loadTableState(): DeviceTableState {
  const defaultState: DeviceTableState = { filters: [], sort: null }
  if (typeof window === "undefined") return defaultState

  let serialized: string | null
  try {
    serialized = window.localStorage.getItem(STORAGE_KEY)
  } catch (error) {
    console.error("Unable to read saved device table settings.", error)
    return defaultState
  }

  if (!serialized) return defaultState

  let saved: unknown
  try {
    saved = JSON.parse(serialized)
  } catch (error) {
    console.error("Saved device table settings are not valid JSON.", error)
    return defaultState
  }

  if (!isRecord(saved) || !Array.isArray(saved.filters) || !("sort" in saved)) {
    console.error("Saved device table settings have an invalid structure.")
    return defaultState
  }

  const parsedFilters = saved.filters.map(parseFilterRule)
  if (parsedFilters.some((filter) => filter === null)) {
    console.warn("Some saved device table filters were invalid and have been ignored.")
  }

  const filters = parsedFilters
    .filter((filter): filter is TableFilterRule<Device> => filter !== null)
    .reduce<TableFilterRule<Device>[]>((uniqueFilters, filter) => {
      const existingIndex = uniqueFilters.findIndex((item) => item.columnKey === filter.columnKey)
      if (existingIndex === -1) uniqueFilters.push(filter)
      else uniqueFilters[existingIndex] = filter
      return uniqueFilters
    }, [])

  let sort: TableSort<Device> | null = null
  const savedSort = saved.sort
  if (savedSort !== null) {
    if (
      isRecord(savedSort) &&
      typeof savedSort.key === "string" &&
      (savedSort.direction === "asc" || savedSort.direction === "desc")
    ) {
      const sortColumn = columns.find(
        (column) => String(column.key) === savedSort.key && column.sortable,
      )
      if (sortColumn) {
        sort = { key: sortColumn.key, direction: savedSort.direction }
      } else {
        console.warn("Saved device table sort references an unavailable column and was ignored.")
      }
    } else {
      console.error("Saved device table sort setting is invalid.")
    }
  }

  return { filters, sort }
}

function dateOnly(value: string): string | null {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const isoDatePrefix = /^(\d{4}-\d{2}-\d{2})/.exec(value)?.[1]
  return isoDatePrefix ?? date.toISOString().slice(0, 10)
}

function matchesFilter(device: Device, filter: TableFilterRule<Device>): boolean {
  const fieldValue = device[filter.columnKey]
  if (fieldValue == null) return false

  if (filter.kind === "status") {
    return String(fieldValue) === filter.value
  }

  if (filter.kind === "text") {
    const actual = String(fieldValue).toLocaleLowerCase()
    const expected = filter.value.toLocaleLowerCase()
    return filter.operator === "equal" ? actual === expected : actual.includes(expected)
  }

  if (filter.kind === "number") {
    if (typeof fieldValue !== "number") return false
    const expected = Number(filter.value)
    switch (filter.operator) {
      case "equal": return fieldValue === expected
      case "lt": return fieldValue < expected
      case "gt": return fieldValue > expected
      case "ltq": return fieldValue <= expected
      case "gtq": return fieldValue >= expected
      case "range":
        return filter.secondValue !== undefined &&
          fieldValue >= expected &&
          fieldValue <= Number(filter.secondValue)
    }
  }

  const actualDate = dateOnly(String(fieldValue))
  if (!actualDate) return false
  switch (filter.operator) {
    case "before": return actualDate < filter.value
    case "after": return actualDate > filter.value
    case "range":
      return filter.secondValue !== undefined &&
        actualDate >= filter.value &&
        actualDate <= filter.secondValue
  }
}

function Devices() {
  const [tableState, setTableState] = useState<DeviceTableState>(loadTableState)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tableState))
    } catch (error) {
      console.error("Unable to save device table settings.", error)
    }
  }, [tableState])

  const filteredDevices = useMemo(
    () => devices.filter((device) => tableState.filters.every((filter) => matchesFilter(device, filter))),
    [tableState.filters],
  )

  function addFilter(filter: TableFilterRule<Device>) {
    setTableState((current) => ({
      ...current,
      filters: [
        ...current.filters.filter((existing) => existing.columnKey !== filter.columnKey),
        filter,
      ],
    }))
  }

  function removeFilter(columnKey: keyof Device) {
    setTableState((current) => ({
      ...current,
      filters: current.filters.filter((filter) => filter.columnKey !== columnKey),
    }))
  }

  return (
    <div className="devices-tab">
      <TableFilter
        columns={columns}
        filters={tableState.filters}
        onAddFilter={addFilter}
        onRemoveFilter={removeFilter}
        onClearFilters={() => setTableState((current) => ({ ...current, filters: [] }))}
      />
      <TableData
        rows={filteredDevices}
        columns={columns}
        getRowKey={(device) => device.macAddress}
        sort={tableState.sort}
        onSortChange={(sort) => setTableState((current) => ({ ...current, sort }))}
      />
    </div>
  )
}

export default Devices
