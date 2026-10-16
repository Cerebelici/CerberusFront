import "./RiskScore.css"
import { severityFromScore } from "../../constants"

interface RiskScoreProps {
    score: number
}

function RiskScore({ score }: RiskScoreProps) {
    const riskLevel = severityFromScore(score)

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
