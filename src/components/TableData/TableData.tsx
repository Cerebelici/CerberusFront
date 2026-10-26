import type { CSSProperties } from "react"
import "./TableData.css"
import { Icon } from "../Icon/Icon"
import type { TableColumn, TableSort } from "./TableTypes"
import TableRows from "./TableRows"

export type { FilterConfig, TableColumn, TableDisplay, TableFilterRule, TableSort } from "./TableTypes"

type TableDataProps<T extends object> = {
    columns: readonly TableColumn<T>[]
} & (
    | { status: "loading" }
    | { status: "error"; message: string }
    | {
        status: "ready"
        rows: readonly T[]
        /** Shown instead of rows when there are none. */
        emptyMessage?: string
        getRowKey: (row: T) => string | number
        sort: TableSort<T> | null
        onSortChange: (sort: TableSort<T>) => void
        onRowClick?: (row: T) => void
        selectedRowKey?: string | number
        pagination?: { pageIndex: number; pageSize: number }
    }
)

type TableStyle = CSSProperties & { "--table-entries": number }

// Each column spans two tracks: the value and a flexible spacer that also holds the sort
// button of the header. Default columns cap the value to an even share of the width, and
// their spacer is at least as wide as the fade drawn on the right edge of the cell, so the
// fade only covers text that is really cut off. "content" columns fit their values and never
// cut them; their spacer is never narrower than the sort button.
function gridTemplate<T>(columns: readonly TableColumn<T>[]): string {
    return columns
        .map((column) => column.size === "content"
            ? "max-content minmax(max-content, 1fr)"
            : "fit-content(var(--max-content-width)) minmax(var(--cell-fade-width), 1fr)")
        .join(" ")
}

function TableData<T extends object>(props: TableDataProps<T>) {
    const { columns } = props
    const sort = props.status === "ready" ? props.sort : null

    const handleSort = (key: keyof T) => {
        if (props.status !== "ready") return

        const direction: TableSort<T>["direction"] =
            sort?.key === key && sort.direction === "asc" ? "desc" : "asc"
        const nextSort = { key, direction }
        props.onSortChange(nextSort)
    }

    return (
        <div
            className="table"
            style={{
                "--table-entries": Math.max(1, columns.filter((column) => column.size === undefined).length),
                gridTemplateColumns: gridTemplate(columns),
            } as TableStyle}
        >
            <div className="table__header">
                {columns.map((column) => (
                    <div className={`table__cell${column.size ? " table__cell--fit" : ""}`} key={String(column.key)}>
                        {column.filter?.kind === "status" ? "" : column.label && (
                            <>
                                <span className="table__header__label">{column.label}</span>
                                {column.sortable && (
                                    <button
                                        className={`table__header__btn${sort?.key === column.key ? " table__header__btn--active" : ""}${sort?.key === column.key && sort.direction === "asc" ? " table__header__btn--up" : ""}`}
                                        type="button"
                                        aria-label={`Sort by ${column.label}`}
                                        aria-pressed={sort?.key === column.key}
                                        disabled={props.status !== "ready"}
                                        onClick={() => handleSort(column.key)}
                                    >
                                        <Icon name="arrow_drop_down" />
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                ))}
            </div>

            {props.status === "loading" && (
                <div className="table__loading" role="status">
                  {[...Array(9)].map((_, index) =>
                    <div className="table__loading__row" key={index}></div>
                  )}
                </div>
            )}
            {props.status === "error" && (
                <div className="table__error" role="alert">{props.message}</div>
            )}
            {props.status === "ready" && props.rows.length === 0 && (
                <div className="table__empty" role="status">{props.emptyMessage ?? "No entries yet."}</div>
            )}
            {props.status === "ready" && (
                <TableRows
                    rows={props.rows}
                    columns={columns}
                    getRowKey={props.getRowKey}
                    sort={props.sort}
                    onRowClick={props.onRowClick}
                    selectedRowKey={props.selectedRowKey}
                    pagination={props.pagination}
                />
            )}
        </div>
    )
}

export default TableData
