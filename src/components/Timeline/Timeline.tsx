import React, { useState, useMemo, useRef, useEffect } from 'react';
import './Timeline.css';

export interface ScanTick {
  scan_id: number;
  timestamp: string;
  scan_type: 'discovery' | 'immediate' | 'vulnerability';
  status: string;
  target_spec: string;
  hosts_found: number;
  duration_ms: number;
}

export interface Period {
  started_at: string;
  ended_at: string;
  status: 'up' | 'down';
  is_vulnerable: boolean;
  vulns_count: number;
  max_severity: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  is_ongoing?: boolean;
  transition_uncertainty_s?: number;
}

export interface DeviceEntry {
  device_id: number;
  ip: string;
  mac?: string;
  hostname?: string;
  vendor?: string;
  current_status: 'up' | 'down';
  periods: Period[];
}

export interface NetworkData {
  time_window: {
    from: string;
    to: string;
    total_scans: number;
    total_devices: number;
  };
  scan_ticks: ScanTick[];
  devices: DeviceEntry[];
}

interface NetworkTimelineProps {
  data: NetworkData;
}

type ZoomPreset = '1h' | '4h' | '8h' | '24h' | 'all';

export const NetworkTimeline: React.FC<NetworkTimelineProps> = ({ data }) => {
  const globalStart = new Date(data.time_window.from).getTime();
  const globalEnd = new Date(data.time_window.to).getTime();
  const totalDuration = globalEnd - globalStart;

  // Zoom & Viewport state
  const [zoomPreset, setZoomPreset] = useState<ZoomPreset>('all');
  const [viewStart, setViewStart] = useState<number>(globalStart);
  const [viewEnd, setViewEnd] = useState<number>(globalEnd);

  // Dragging state for minimap handles or window body
  const [draggingMode, setDraggingMode] = useState<'left' | 'right' | 'window' | null>(null);
  const [dragStartX, setDragStartX] = useState<number>(0);
  const [dragStartViewStart, setDragStartViewStart] = useState<number>(globalStart);
  const [dragStartViewEnd, setDragStartViewEnd] = useState<number>(globalEnd);

  const minimapRef = useRef<HTMLDivElement>(null);

  // Hover tooltip state
  const [activeTooltip, setActiveTooltip] = useState<{
    type: 'device' | 'scan';
    title: string;
    details: string[];
    x: number;
    y: number;
  } | null>(null);

  const formatDateTime = (timestamp: string | number) => {
    const d = new Date(timestamp);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const handlePresetChange = (preset: ZoomPreset) => {
    setZoomPreset(preset);
    if (preset === 'all') {
      setViewStart(globalStart);
      setViewEnd(globalEnd);
      return;
    }

    const hoursMap: Record<string, number> = { '1h': 1, '4h': 4, '8h': 8, '24h': 24 };
    const durationMs = hoursMap[preset] * 3600 * 1000;
    const newStart = Math.max(globalStart, globalEnd - durationMs);
    setViewStart(newStart);
    setViewEnd(globalEnd);
  };

  const timeToPercent = (timestamp: string | number) => {
    const time = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
    if (viewEnd === viewStart) return 0;
    return Math.max(0, Math.min(100, ((time - viewStart) / (viewEnd - viewStart)) * 100));
  };

  // Generate equally-spaced grid lines across current view window
  const gridLines = useMemo(() => {
    const count = 6;
    const span = viewEnd - viewStart;
    const step = span / count;
    const lines = [];
    for (let i = 0; i <= count; i++) {
      const time = viewStart + i * step;
      lines.push({
        time,
        percent: (i / count) * 100,
        label: formatDateTime(time),
      });
    }
    return lines;
  }, [viewStart, viewEnd]);

  // Minimap drag handlers
  const handleMouseDown = (mode: 'left' | 'right' | 'window') => (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraggingMode(mode);
    setDragStartX(e.clientX);
    setDragStartViewStart(viewStart);
    setDragStartViewEnd(viewEnd);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingMode || !minimapRef.current) return;
      const rect = minimapRef.current.getBoundingClientRect();
      const deltaX = e.clientX - dragStartX;
      const deltaRatio = deltaX / rect.width;
      const deltaMs = deltaRatio * totalDuration;

      if (draggingMode === 'left') {
        let newStart = dragStartViewStart + deltaMs;
        newStart = Math.max(globalStart, Math.min(newStart, dragStartViewEnd - 60000));
        setViewStart(newStart);
        setZoomPreset('all');
      } else if (draggingMode === 'right') {
        let newEnd = dragStartViewEnd + deltaMs;
        newEnd = Math.min(globalEnd, Math.max(newEnd, dragStartViewStart + 60000));
        setViewEnd(newEnd);
        setZoomPreset('all');
      } else if (draggingMode === 'window') {
        const span = dragStartViewEnd - dragStartViewStart;
        let newStart = dragStartViewStart + deltaMs;
        let newEnd = dragStartViewEnd + deltaMs;

        if (newStart < globalStart) {
          newStart = globalStart;
          newEnd = globalStart + span;
        }
        if (newEnd > globalEnd) {
          newEnd = globalEnd;
          newStart = globalEnd - span;
        }

        setViewStart(newStart);
        setViewEnd(newEnd);
        setZoomPreset('all');
      }
    };

    const handleMouseUp = () => setDraggingMode(null);

    if (draggingMode) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingMode, dragStartX, dragStartViewStart, dragStartViewEnd, globalStart, globalEnd, totalDuration]);

  const getDeviceLabel = (device: DeviceEntry) => {
    if (device.hostname) return device.hostname;
    if (device.vendor) return device.vendor;
    if (device.mac) return device.mac;
    if (device.ip) return device.ip;
    return `ID: ${device.device_id}`;
  };

  const getSeverityClass = (severity: string, isVulnerable: boolean, status: string) => {
    if (status === 'down') return 'status-down';
    if (!isVulnerable) return 'status-secure';
    switch (severity) {
      case 'CRITICAL': return 'vuln-critical';
      case 'HIGH': return 'vuln-high';
      case 'MEDIUM': return 'vuln-medium';
      case 'LOW': return 'vuln-low';
      default: return 'vuln-secure';
    }
  };

  const leftPercent = ((viewStart - globalStart) / totalDuration) * 100;
  const widthPercent = ((viewEnd - viewStart) / totalDuration) * 100;

  return (
    <div className="net-timeline-container">
      {/* Top Control Bar */}
      <div className="net-timeline-controls">
        <div className="control-group">
          <span className="control-label">Scope:</span>
          {(['1h', '4h', '8h', '24h', 'all'] as ZoomPreset[]).map((preset) => (
            <button
              key={preset}
              className={`control-btn ${zoomPreset === preset ? 'active' : ''}`}
              onClick={() => handlePresetChange(preset)}
            >
              {preset.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="control-info">
          <span>Devices: {data.devices.length}</span>
          <span>Scans: {data.scan_ticks.length}</span>
        </div>
      </div>

      {/* Main Timeline Workspace */}
      <div className="net-workspace">
        {/* Left Sticky Header Column */}
        <div className="net-sidebar">
          <div className="sidebar-header-cell">Device Endpoint</div>
          {data.devices.map((device) => {
            const primaryLabel = getDeviceLabel(device);
            const maxVulns = Math.max(...device.periods.map((p) => p.vulns_count || 0));

            return (
              <div
                key={device.device_id}
                className="sidebar-row"
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setActiveTooltip({
                    type: 'device',
                    title: `Device ID: ${device.device_id}`,
                    details: [
                      `IP: ${device.ip}`,
                      `MAC: ${device.mac || 'N/A'}`,
                      `Hostname: ${device.hostname || 'N/A'}`,
                      `Status: ${device.current_status}`,
                    ],
                    x: rect.right + 10,
                    y: rect.top,
                  });
                }}
                onMouseLeave={() => setActiveTooltip(null)}
              >
                {maxVulns > 0 && <span className="vuln-badge">{maxVulns}</span>}
                <span className="device-label-text" title={primaryLabel}>
                  {primaryLabel}
                </span>
                <span className="device-ip-sub">({device.ip})</span>
              </div>
            );
          })}
        </div>

        {/* Right Graph Track Area */}
        <div className="net-graph-scroll-area">
          {/* Scan Tick Track Header */}
          <div className="scan-track-header">
            {data.scan_ticks.map((scan) => {
              const leftPos = timeToPercent(scan.timestamp);
              if (leftPos < 0 || leftPos > 100) return null;
              return (
                <div
                  key={scan.scan_id}
                  className={`scan-tick-line scan-${scan.scan_type}`}
                  style={{ left: `${leftPos}%` }}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setActiveTooltip({
                      type: 'scan',
                      title: `Scan #${scan.scan_id} (${scan.scan_type})`,
                      details: [
                        `Time: ${formatDateTime(scan.timestamp)}`,
                        `Target: ${scan.target_spec}`,
                        `Hosts Found: ${scan.hosts_found}`,
                        `Duration: ${scan.duration_ms}ms`,
                      ],
                      x: rect.left,
                      y: rect.bottom + 5,
                    });
                  }}
                  onMouseLeave={() => setActiveTooltip(null)}
                />
              );
            })}
          </div>

          {/* Device Timeline Rows */}
          {data.devices.map((device) => (
            <div key={device.device_id} className="graph-row">
              {gridLines.map((grid, idx) => (
                <div key={idx} className="grid-vertical-line" style={{ left: `${grid.percent}%` }} />
              ))}

              {device.periods.map((period, idx) => {
                const startPct = timeToPercent(period.started_at);
                const endPct = timeToPercent(period.ended_at);
                const widthPct = Math.max(0.5, endPct - startPct);
                const statusClass = getSeverityClass(period.max_severity, period.is_vulnerable, period.status);
                const hasUncertainty = (period.transition_uncertainty_s || 0) > 0;

                return (
                  <div
                    key={idx}
                    className={`timeline-bar ${statusClass} ${hasUncertainty ? 'has-uncertainty' : ''}`}
                    style={{
                      left: `${startPct}%`,
                      width: `${widthPct}%`,
                    }}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setActiveTooltip({
                        type: 'device',
                        title: `Period State: ${period.status.toUpperCase()}`,
                        details: [
                          `Vulnerabilities: ${period.vulns_count} (${period.max_severity})`,
                          `Started: ${formatDateTime(period.started_at)}`,
                          `Ended: ${formatDateTime(period.ended_at)}`,
                          `Uncertainty: ±${period.transition_uncertainty_s || 0}s`,
                        ],
                        x: rect.left,
                        y: rect.bottom + 5,
                      });
                    }}
                    onMouseLeave={() => setActiveTooltip(null)}
                  >
                    {hasUncertainty && <div className="uncertainty-stripe-overlay" />}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Time Labels Track at the Bottom */}
          <div className="time-labels-track">
            {gridLines.map((grid, idx) => (
              <span
                key={idx}
                className="time-label-tick"
                style={{ left: `${grid.percent}%` }}
              >
                {grid.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Minimap with Bounds Handles */}
      <div className="net-minimap-container">
        <div className="minimap-track" ref={minimapRef}>
          <div
            className="minimap-window-region"
            style={{
              left: `${leftPercent}%`,
              width: `${widthPercent}%`,
            }}
            onMouseDown={handleMouseDown('window')}
          >
            <div className="minimap-handle left" onMouseDown={handleMouseDown('left')} />
            <div className="minimap-handle right" onMouseDown={handleMouseDown('right')} />
          </div>
        </div>
        <div className="minimap-labels">
          <span>{formatDateTime(globalStart)}</span>
          <span>Drag bounds or window to adjust view</span>
          <span>{formatDateTime(globalEnd)}</span>
        </div>
      </div>

      {/* Floating Tooltip */}
      {activeTooltip && (
        <div
          className="net-floating-tooltip"
          style={{ top: activeTooltip.y + 'px', left: activeTooltip.x + 'px' }}
        >
          <div className="tooltip-title">{activeTooltip.title}</div>
          {activeTooltip.details.map((line, i) => (
            <div key={i} className="tooltip-line">
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};