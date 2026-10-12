import { useState, type SubmitEvent } from "react"
import "./TableFilter.css"
import { Icon } from "../Icon/Icon"
import type { FilterConfig, TableColumn, TableFilterRule } from "../TableData/TableData"

interface TableFilterProps<T extends object> {
  columns: readonly TableColumn<T>[]
  filters: readonly TableFilterRule<T>[]
  onAddFilter: (filter: TableFilterRule<T>) => void
  onRemoveFilter: (columnKey: keyof T) => void
  onClearFilters: () => void
}

type OperatorOption = {
  value: string
  label: string
}

type OperatorKind = Exclude<FilterConfig["kind"], "status">

const operatorsByKind: Record<OperatorKind, readonly OperatorOption[]> = {
  text: [
    { value: "equal", label: "Matches" },
    { value: "contains", label: "Contains" },
  ],
  number: [
    { value: "equal", label: "Equals" },
    { value: "lt", label: "Less than" },
    { value: "gt", label: "Greater than" },
    { value: "ltq", label: "Less than or equals" },
    { value: "gtq", label: "Greater than or equals" },
    { value: "range", label: "Range" },
  ],
  date: [
    { value: "before", label: "Before" },
    { value: "after", label: "After" },
    { value: "range", label: "Range" },
  ],
}

function getRuleDescription<T extends object>(
  rule: TableFilterRule<T>,
): string {
  if (rule.kind === "status") return rule.value

  const operator = operatorsByKind[rule.kind].find((option) => option.value === rule.operator)
  const value = rule.operator === "range" && rule.secondValue
    ? `${rule.value} – ${rule.secondValue}`
    : rule.value

  return `${operator?.label ?? rule.operator} ${value}`
}

function TableFilter<T extends object>({
  columns,
  filters,
  onAddFilter,
  onRemoveFilter,
  onClearFilters,
}: TableFilterProps<T>) {
  const [dialogIsOpen, setDialog] = useState(false)
  const [selectedColumnKey, setSelectedColumnKey] = useState("")
  const [selectedOperator, setSelectedOperator] = useState("")
  const [value, setValue] = useState("")
  const [secondValue, setSecondValue] = useState("")
  const [validationError, setValidationError] = useState("")

  const filterableColumns = columns.filter((column) => column.filter)
  const selectedColumn = filterableColumns.find(
    (column) => String(column.key) === selectedColumnKey,
  )
  const selectedFilter = selectedColumn?.filter
  const operatorOptions = selectedFilter && selectedFilter.kind !== "status"
    ? operatorsByKind[selectedFilter.kind]
    : []

  function resetForm() {
    setSelectedColumnKey("")
    setSelectedOperator("")
    setValue("")
    setSecondValue("")
    setValidationError("")
  }

  function handleColumnChange(columnKey: string) {
    setSelectedColumnKey(columnKey)
    setSelectedOperator("")
    setValue("")
    setSecondValue("")
    setValidationError("")
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setValidationError("")

    if (!selectedColumn || !selectedFilter) return

    if (selectedFilter.kind === "status") {
      if (!selectedFilter.options.includes(value)) return
      onAddFilter({ columnKey: selectedColumn.key, kind: "status", value })
    } else if (selectedFilter.kind === "text") {
      if (selectedOperator !== "equal" && selectedOperator !== "contains") return
      if (!value.trim()) {
        setValidationError("Enter a value to filter by.")
        return
      }
      onAddFilter({
        columnKey: selectedColumn.key,
        kind: "text",
        operator: selectedOperator,
        value: value.trim(),
      })
    } else if (selectedFilter.kind === "number") {
      if (
        selectedOperator !== "equal" &&
        selectedOperator !== "lt" &&
        selectedOperator !== "gt" &&
        selectedOperator !== "ltq" &&
        selectedOperator !== "gtq" &&
        selectedOperator !== "range"
      ) return

      const firstNumber = Number(value)
      const secondNumber = Number(secondValue)
      if (!Number.isFinite(firstNumber)) return
      if (selectedOperator === "range" && !Number.isFinite(secondNumber)) return
      if (selectedOperator === "range" && firstNumber > secondNumber) {
        setValidationError("The minimum must not be greater than the maximum.")
        return
      }

      onAddFilter({
        columnKey: selectedColumn.key,
        kind: "number",
        operator: selectedOperator,
        value: String(firstNumber),
        ...(selectedOperator === "range" ? { secondValue: String(secondNumber) } : {}),
      })
    } else {
      if (
        selectedOperator !== "before" &&
        selectedOperator !== "after" &&
        selectedOperator !== "range"
      ) return

      if (!value || Number.isNaN(Date.parse(value))) return
      if (selectedOperator === "range" && (!secondValue || Number.isNaN(Date.parse(secondValue)))) return
      if (selectedOperator === "range" && value > secondValue) {
        setValidationError("The start date must not be after the end date.")
        return
      }

      onAddFilter({
        columnKey: selectedColumn.key,
        kind: "date",
        operator: selectedOperator,
        value,
        ...(selectedOperator === "range" ? { secondValue } : {}),
      })
    }

    resetForm()
    setDialog(false)
  }

  function renderValueControl() {
    if (!selectedFilter) return null

    if (selectedFilter.kind === "status") {
      return (
        <select
          id="value-input"
          className="btn btn--light dialog__form__select"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          required
        >
          <option value="" disabled>Select a status...</option>
          {selectedFilter.options.map((option) => (
            <option key={option} value={option} className="dialog__form__option">
              {option}
            </option>
          ))}
        </select>
      )
    }

    const inputType = selectedFilter.kind === "text"
      ? "text"
      : selectedFilter.kind === "number"
        ? "number"
        : "date"

    if (selectedOperator === "range") {
      const rangeLabels = selectedFilter.kind === "date"
        ? ["Start", "End"]
        : ["Min", "Max"]

      return (
        <div className="dialog__form__range">
          <div className="dialog__form__range__col">
            <label htmlFor="value-input-primary">{rangeLabels[0]}</label>
            <input
              type={inputType}
              id="value-input-primary"
              step={selectedFilter.kind === "number" ? "any" : undefined}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className="btn btn--light dialog__form__select dialog__form__input"
              required
            />
          </div>
          <div className="dialog__form__range__col">
            <label htmlFor="value-input-secondary">{rangeLabels[1]}</label>
            <input
              type={inputType}
              id="value-input-secondary"
              step={selectedFilter.kind === "number" ? "any" : undefined}
              value={secondValue}
              onChange={(event) => setSecondValue(event.target.value)}
              className="btn btn--light dialog__form__select dialog__form__input"
              required
            />
          </div>
        </div>
      )
    }

    return (
      <input
        type={inputType}
        id="value-input"
        step={selectedFilter.kind === "number" ? "any" : undefined}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={selectedFilter.kind === "text" ? "Enter text..." : undefined}
        className="btn btn--light dialog__form__select dialog__form__input"
        required
      />
    )
  }

  return (
    <div className="filter">
      <div className="filter-btns">
        <div className="filter__set-dialog-anchor">
          <button
            className={`btn btn--accent filter__set-btn${dialogIsOpen ? " filter__set-btn--dialog-open" : ""}`}
            type="button"
            aria-expanded={dialogIsOpen}
            onClick={() => setDialog((isOpen) => !isOpen)}
          >
            <Icon name="search" className="filter__icon" />
            <span className="filter__btn-label">Filter by</span>
          </button>

          {dialogIsOpen && (
            <dialog open className="filter__dialog" aria-label="Add table filter">
              <form className="dialog__form" onSubmit={handleSubmit}>
                <div className="dialog__form__row">
                  <label htmlFor="column-select">Column</label>
                  <select
                    id="column-select"
                    className="btn btn--light dialog__form__select"
                    value={selectedColumnKey}
                    onChange={(event) => handleColumnChange(event.target.value)}
                    required
                  >
                    <option value="" disabled>Select a column...</option>
                    {filterableColumns.map((column) => (
                      <option
                        key={String(column.key)}
                        value={String(column.key)}
                        className="dialog__form__option"
                      >
                        {column.label || String(column.key)}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedFilter && selectedFilter.kind !== "status" && (
                  <div className="dialog__form__row">
                    <label htmlFor="operator-select">Operator</label>
                    <select
                      id="operator-select"
                      className="btn btn--light dialog__form__select"
                      value={selectedOperator}
                      onChange={(event) => {
                        setSelectedOperator(event.target.value)
                        setValue("")
                        setSecondValue("")
                        setValidationError("")
                      }}
                      required
                    >
                      <option value="" disabled>Select an operator...</option>
                      {operatorOptions.map((operator) => (
                        <option key={operator.value} value={operator.value} className="dialog__form__option">
                          {operator.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedFilter && (
                  <div className="dialog__form__row">
                    <label htmlFor={selectedOperator === "range" ? "value-input-primary" : "value-input"}>
                      Value
                    </label>
                    {renderValueControl()}
                  </div>
                )}
                {validationError && <p role="alert">{validationError}</p>}

                <div className="dialog__btn-footer">
                  <button
                    className="btn dialog__btn-cancel"
                    type="button"
                    aria-label="Cancel"
                    onClick={() => {
                      resetForm()
                      setDialog(false)
                    }}
                  >
                    <Icon name="close" className="dialog__icon" />
                  </button>
                  <button className="btn btn--light dialog__btn-submit" type="submit" aria-label="Apply filter">
                    <Icon name="add" className="dialog__icon" />
                  </button>
                </div>
              </form>
            </dialog>
          )}
        </div>

        <button
          className="btn btn--dark filter__clear-btn"
          type="button"
          onClick={onClearFilters}
          disabled={filters.length === 0}
        >
          <Icon name="delete" className="filter__icon" />
          <span>Clear all</span>
        </button>
      </div>

      <div className="filter-settings">
        {filters.length === 0 ? (
          <p className="filter-settings__empty-label">NO FILTERS APPLIED</p>
        ) : (
          filters.map((filter) => {
            const column = columns.find((candidate) => candidate.key === filter.columnKey)
            if (!column) return null

            return (
              <div className="filter__setting" key={String(filter.columnKey)}>
                <p className="filter__setting__label">{column.label || String(column.key)}:</p>
                <p className="filter__setting__type">{getRuleDescription(filter)}</p>
                <button
                  className="filter__setting__remove"
                  type="button"
                  aria-label={`Remove ${column.label || String(column.key)} filter`}
                  onClick={() => onRemoveFilter(filter.columnKey)}
                >
                  <Icon name="close" className="filter__icon" />
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default TableFilter
