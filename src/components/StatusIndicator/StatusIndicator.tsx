import "./StatusIndicator.css"

interface StatusIndicatorProps {
    value: string
    activeValues: readonly string[]
}

function StatusIndicator({ value, activeValues }: StatusIndicatorProps) {
    const isActive = activeValues.includes(value)

    return (
        <span
            className={`status-indicator${isActive ? " status-indicator--on" : " status-indicator--off"}`}
            role="img"
            aria-label={value}
            title={value}
        />
    )
}

export default StatusIndicator
