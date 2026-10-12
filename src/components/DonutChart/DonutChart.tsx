import React from "react";
import "./DonutChart.css"
import type { Severity } from "../../constants";

interface DonutProps {
  score: number;
  maxScore?: number; // default 100
  fractionDigits?: number; // default 2
  showPercentSign?: boolean; // default false
  rank?: Severity // default none
}

function DonutChart({ 
  score, 
  maxScore = 100, 
  fractionDigits = 2, 
  showPercentSign = false,
  rank = 'none'
}: DonutProps) {
  const progress = Math.min(1, Math.max(0, (score / maxScore)));

  return (
    <div className={`donut-chart donut-chart--${rank}`} 
    style={{'--progress': `${progress}`} as React.CSSProperties}
    >
      <svg className="donut-svg">
        <circle className="donut-svg__background"/>
        <circle className="donut-svg__fill"/>
      </svg>
      <div className="donut-label">
        <p className={`donut-label__score ${showPercentSign ? 'donut-label__score--percent' : ''}`}>
          {score.toFixed(fractionDigits) + (showPercentSign ? '%' : '')}
        </p>
        <p className="donut-label__title">Overall vulnerability score</p>
      </div>
    </div>
  )
}

export default DonutChart