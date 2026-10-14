import { useEffect, useMemo, useState } from "react"
import type { TableColumn, TableFilterRule, TableSort } from "./TableTypes"

interface TableState<T> {
  filters: TableFilterRule<T>[]
  sort: TableSort<T> | null
}

interface UseTableStateOptions<T extends object> {
  rows: readonly T[]
  columns: readonly TableColumn<T>[]
  storageKey: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isDateValue(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function parseFilterRule<T extends object>(
  value: unknown,
  columns: readonly TableColumn<T>[],
): TableFilterRule<T> | null {
  if (!isRecord(value) || typeof value.columnKey !== "string" || typeof value.value !== "string") {
    return null
  }

  const column = columns.find(
    (candidate) => String(candidate.key) === value.columnKey && candidate.filter,
  )
  if (!column?.filter) return null

  switch (column.filter.kind) {
    case "status":
      return column.filter.options.includes(value.value)
        ? { columnKey: column.key, kind: "status", value: value.value }
        : null
    case "text":
      if ((value.operator === "equal" || value.operator === "contains") && value.value.trim()) {
        return {
          columnKey: column.key,
          kind: "text",
          operator: value.operator,
          value: value.value,
        }
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
      if (!value.value.trim() || !Number.isFinite(Number(value.value))) return null

      const secondValue = value.secondValue
      if (value.operator === "range") {
        if (
          typeof secondValue !== "string" ||
          !secondValue.trim() ||
          !Number.isFinite(Number(secondValue)) ||
          Number(value.value) > Number(secondValue)
        ) return null
        return {
          columnKey: column.key,
          kind: "number",
          operator: value.operator,
          value: value.value,
          secondValue,
        }
      }

      return { columnKey: column.key, kind: "number", operator: value.operator, value: value.value }
    }
    case "date": {
      if (value.operator !== "before" && value.operator !== "after" && value.operator !== "range") {
        return null
      }
      if (!isDateValue(value.value)) return null

      const secondValue = value.secondValue
      if (value.operator === "range") {
        if (typeof secondValue !== "string" || !isDateValue(secondValue) || value.value > secondValue) {
          return null
        }
        return {
          columnKey: column.key,
          kind: "date",
          operator: value.operator,
          value: value.value,
          secondValue,
        }
      }

      return { columnKey: column.key, kind: "date", operator: value.operator, value: value.value }
    }
  }
}

function parseTableState<T extends object>(
  saved: unknown,
  columns: readonly TableColumn<T>[],
): TableState<T> {
  if (!isRecord(saved) || !Array.isArray(saved.filters) || !("sort" in saved)) {
    throw new Error("Saved table state has an invalid structure.")
  }

  const parsedFilters = saved.filters.map((filter) => parseFilterRule(filter, columns))
  if (parsedFilters.some((filter) => filter === null)) {
    console.warn("Some saved table filters were invalid and have been ignored.")
  }

  const filters = parsedFilters
    .filter((filter): filter is TableFilterRule<T> => filter !== null)
    .reduce<TableFilterRule<T>[]>((uniqueFilters, filter) => {
      const existingIndex = uniqueFilters.findIndex((item) => item.columnKey === filter.columnKey)
      if (existingIndex === -1) uniqueFilters.push(filter)
      else uniqueFilters[existingIndex] = filter
      return uniqueFilters
    }, [])

  let sort: TableSort<T> | null = null
  const savedSort = saved.sort
  if (savedSort !== null) {
    if (
      !isRecord(savedSort) ||
      typeof savedSort.key !== "string" ||
      (savedSort.direction !== "asc" && savedSort.direction !== "desc")
    ) {
      console.warn("Saved table sort setting is invalid and has been ignored.")
    } else {
      const sortColumn = columns.find(
        (column) => String(column.key) === savedSort.key && column.sortable,
      )
      if (sortColumn) {
        sort = { key: sortColumn.key, direction: savedSort.direction }
      } else {
        console.warn("Saved table sort references an unavailable column and has been ignored.")
      }
    }
  }

  return { filters, sort }
}

function loadTableState<T extends object>(
  storageKey: string,
  columns: readonly TableColumn<T>[],
): TableState<T> {
  const emptyState: TableState<T> = { filters: [], sort: null }
  if (typeof window === "undefined") return emptyState

  let serialized: string | null
  try {
    serialized = window.localStorage.getItem(storageKey)
  } catch (error) {
    console.error(`Unable to read saved table settings for "${storageKey}".`, error)
    return emptyState
  }

  if (!serialized) return emptyState

  try {
    return parseTableState(JSON.parse(serialized), columns)
  } catch (error) {
    console.error(`Unable to load saved table settings for "${storageKey}".`, error)
    return emptyState
  }
}

function dateOnly(value: string): string | null {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const isoDatePrefix = /^(\d{4}-\d{2}-\d{2})/.exec(value)?.[1]
  return isoDatePrefix ?? date.toISOString().slice(0, 10)
}

function matchesFilter<T extends object>(row: T, filter: TableFilterRule<T>): boolean {
  const fieldValue = row[filter.columnKey]
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

export function useTableState<T extends object>({
  rows,
  columns,
  storageKey,
}: UseTableStateOptions<T>) {
  const [tableState, setTableState] = useState<TableState<T>>(
    () => loadTableState(storageKey, columns),
  )

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(tableState))
    } catch (error) {
      console.error(`Unable to save table settings for "${storageKey}".`, error)
    }
  }, [storageKey, tableState])

  const filteredRows = useMemo(
    () => rows.filter((row) => tableState.filters.every((filter) => matchesFilter(row, filter))),
    [rows, tableState.filters],
  )

  function addFilter(filter: TableFilterRule<T>) {
    setTableState((current) => ({
      ...current,
      filters: [
        ...current.filters.filter((existing) => existing.columnKey !== filter.columnKey),
        filter,
      ],
    }))
  }

  function removeFilter(columnKey: keyof T) {
    setTableState((current) => ({
      ...current,
      filters: current.filters.filter((filter) => filter.columnKey !== columnKey),
    }))
  }

  function clearFilters() {
    setTableState((current) => ({ ...current, filters: [] }))
  }

  function changeSort(sort: TableSort<T>) {
    setTableState((current) => ({ ...current, sort }))
  }

  return {
    rows: filteredRows,
    filters: tableState.filters,
    sort: tableState.sort,
    addFilter,
    removeFilter,
    clearFilters,
    changeSort,
  }
}
