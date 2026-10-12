import "./RiskScore.css"

interface RiskScoreProps {
    score: number
}

type RiskLevel = "none" | "low" | "medium" | "high" | "critical"

function getRiskLevel(score: number): RiskLevel {
    if (score >= 9) return "critical"
    if (score >= 7) return "high"
    if (score >= 4) return "medium"
    if (score > 0) return "low"
    return "none"
}

function RiskScore({ score }: RiskScoreProps) {
    const riskLevel = getRiskLevel(score)

    return (
        <div className="risk-score">
            <span className="table__row__value">{score.toFixed(1)}</span>
            <span
                className={`risk-score__rank risk-score__rank--${riskLevel}`}
                role="img"
                aria-label={riskLevel}
            />
        </div>
    )
}

export default RiskScore
