export type FilterConfig =
  | { kind: "text" }
  | { kind: "number" }
  | { kind: "date" }
  | { kind: "status"; options: readonly string[] }

export type TableDisplay =
  | { kind: "status"; activeValues: readonly string[] }
  | { kind: "risk-score" }
  | { kind: "date" }

export interface TableColumn<T> {
  key: keyof T
  label: string
  /**
   * How the column takes width. By default it gets an even share and long text is cut with a
   * fade (hover shows it all). "content" always fits its values: use it for values with a
   * known short length (status dots, IPs, MACs, dates, counts, action buttons).
   */
  size?: "content"
  sortable?: boolean
  filter?: FilterConfig
  display?: TableDisplay
  render?: (value: T[keyof T], row: T) => React.ReactNode
}

export interface TableSort<T> {
  key: keyof T
  direction: "asc" | "desc"
}

export type TableFilterRule<T> =
  | { columnKey: keyof T; kind: "text"; operator: "equal" | "contains"; value: string }
  | {
      columnKey: keyof T
      kind: "number"
      operator: "equal" | "lt" | "gt" | "ltq" | "gtq" | "range"
      value: string
      secondValue?: string
    }
  | {
      columnKey: keyof T
      kind: "date"
      operator: "before" | "after" | "range"
      value: string
      secondValue?: string
    }
  | { columnKey: keyof T; kind: "status"; value: string }
