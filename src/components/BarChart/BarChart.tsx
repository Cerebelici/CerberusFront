import React, { useMemo } from 'react';
import './BarChart.css';

type ChartScale = {
  maxValue: number;
  yTicks: number[];
}

function calculateChartScale(
  values: number[],
  tickCount: number = 5,
  step: number = 50
): ChartScale {
  const peakValue = values.length > 0 ? Math.max(...values) : 0;

  let maxValue = Math.ceil(peakValue / step) * step;

  if (maxValue === 0) {
    maxValue = step * (tickCount - 1);
  }

  const yTicks: number[] = [];
  const interval = maxValue / (tickCount - 1);

  for (let i = 0; i < tickCount; i++) {
    yTicks.push(Math.round(maxValue - i * interval));
  }

  return { maxValue: maxValue, yTicks };
}

export interface BarDataItem {
  label: string;
  value: number;
}

interface BarChartProps {
  title: string;
  data: BarDataItem[];
  tickCount?: number
  step?: number
}

// For now it would be best for the visual sake to keep data to 3 items, 5 ticks (labels with grid lines), in increments of 50
function BarChart({title, data, tickCount = 5, step = 50}: BarChartProps) {

  const dataValues = useMemo(() => data.map((d) => d.value), [data]); //without Memo: data.map((d) => d.value);
  const {maxValue, yTicks} = calculateChartScale(dataValues, tickCount, step)
  
  return (
    <div className="barchart">
      <p className="barchart__title">{title}</p>

      <div className="barchart__body">
        {/* Y-Axis tick labels */}
        <div className="barchart__y-axis">
          {yTicks.map((tick) => (
            <div key={tick} className="barchart__y-tick">
              <span className="barchart__y-label">{tick}</span>
              {/* <div className="barchart__grid-line" /> */}
            </div>
          ))}
        </div>

        {/* Bars (columns) container and grid lines */}
        <div className="barchart__bars">
          <div className="barchart__grid-lines-container" aria-hidden="true">
            {yTicks.map((tick, index) => (
              <div
                key={tick}
                className="barchart__grid-line"
                style={{ '--line-offset': `${(index / (yTicks.length - 1)) * 100}%` } as React.CSSProperties}
              />
            ))}
          </div>
          {data.map((item) => {
            // Calculate percentage height based on max tick value
            const heightPercent = Math.min(100, Math.max(0, (item.value / maxValue) * 100));
            return (
              <div
                key={item.label}
                className="barchart__column"
                style={{ '--bar-height': `${heightPercent}%` } as React.CSSProperties}
              >
                <div className="barchart__bar">
                  <span className="barchart__value">{item.value}</span>
                </div>
                <span className="barchart__x-label">{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  )
}

export default BarChart