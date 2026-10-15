import { useMemo } from "react"
import "./TableData.css"
import StatusIndicator from "../StatusIndicator/StatusIndicator"
import RiskScore from "../RiskScore/RiskScore"
import type { TableColumn, TableSort } from "./TableTypes"

// export type { FilterConfig, TableColumn, TableDisplay, TableFilterRule, TableSort } from "./TableTypes"

interface TableRowsProps<T> 
{
  rows: readonly T[]
  columns: readonly TableColumn<T>[]
  getRowKey: (row: T) => string | number
  sort: TableSort<T> | null
  onRowClick?: (row: T) => void
  selectedRowKey?: string | number
}

function compareValues<T extends object>(left: T, right: T, column: TableColumn<T>): number {
    const leftValue = left[column.key]
    const rightValue = right[column.key]

    if (leftValue == null) return rightValue == null ? 0 : 1
    if (rightValue == null) return -1

    if (column.filter?.kind === "number") {
        if (typeof leftValue === "number" && typeof rightValue === "number") {
            return leftValue - rightValue
        }
    }

    if (column.filter?.kind === "date") {
        const leftDate = Date.parse(String(leftValue))
        const rightDate = Date.parse(String(rightValue))
        if (!Number.isNaN(leftDate) && !Number.isNaN(rightDate)) {
            return leftDate - rightDate
        }
    }

    return String(leftValue).localeCompare(String(rightValue), undefined, {
        numeric: true,
        sensitivity: "base",
    })
}

function TableRows<T extends object>({
    rows,
    columns,
    getRowKey,
    sort,
    onRowClick,
    selectedRowKey,
}: TableRowsProps<T>) {
    const sortedRows = useMemo(() => {
        if (!sort) return rows

        const column = columns.find((candidate) => candidate.key === sort.key)
        if (!column?.sortable) return rows

        return [...rows].sort((left, right) => {
            const comparison = compareValues(left, right, column)
            return sort.direction === "asc" ? comparison : -comparison
        })
    }, [rows, columns, sort])

    return (
        <>
            {sortedRows.map((row) => {
                const rowKey = getRowKey(row)
                const isSelected = rowKey === selectedRowKey

                return (
                <div
                    className={`table__row${isSelected ? " table__row--selected" : ""}`}
                    key={rowKey}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    onKeyDown={onRowClick ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            onRowClick(row)
                        }
                    } : undefined}
                    role={onRowClick ? "button" : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                >
                    {columns.map((column) => {
                        const value = row[column.key]
                        const displayValue = String(value ?? "—")
                        let content

                        if (column.display?.kind === "status") {
                            content = (
                                <StatusIndicator
                                    value={displayValue}
                                    activeValues={column.display.activeValues}
                                />
                            )
                        } else if (column.display?.kind === "risk-score") {
                            content = typeof value === "number"
                                ? <RiskScore score={value} />
                                : displayValue
                        } else if (column.display?.kind === "date" && value != null) {
                            const timestamp = Date.parse(displayValue)
                            const formattedValue = Number.isNaN(timestamp)
                                ? displayValue
                                : new Date(timestamp).toLocaleString()
                            content = (
                                <span className="table__value-container" data-full-value={formattedValue}>
                                    <span className="table__row__value">{formattedValue}</span>
                                </span>
                            )
                        } else {
                            content = (
                                <span
                                    className="table__value-container"
                                    data-full-value={displayValue}
                                >
                                    <span className="table__row__value">{displayValue}</span>
                                </span>
                            )
                        }

                        return (
                            <div className="table__cell" key={String(column.key)}>
                                {content}
                            </div>
                        )
                    })}
                </div>
                )
            })}
        </>
    )
}

export default TableRows