import { useState, useEffect, useRef, useMemo } from 'react';
import './DebugLogs.css';
import { Icon } from '../Icon/Icon';
import { logger, type LogEntry, type LogLevel } from '../../services/logger';
import { useSystemStatus } from '../../state/useSystemStatus';
import { fetchScanHistory } from '../scan/scanApi';

export default function DebugLogs() {
  const [logs, setLogs] = useState<LogEntry[]>(() => logger.getLogs());
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [selectedSource, setSelectedSource] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const { status, error: statusError } = useSystemStatus();
  const logViewportRef = useRef<HTMLDivElement>(null);

  // Subscribe to live log events
  useEffect(() => {
    const unsubscribe = logger.subscribe((_entry, allLogs) => {
      setLogs([...allLogs]);
    });
    return () => unsubscribe();
  }, []);

  // Poll & ingest real backend Nmap scans from GET /api/scans
  useEffect(() => {
    let cancelled = false;
    const syncScans = async () => {
      try {
        const history = await fetchScanHistory(20);
        if (!cancelled && history && Array.isArray(history)) {
          // Ingest in chronological order (oldest first)
          const chronological = [...history].reverse();
          for (const scan of chronological) {
            logger.ingestBackendScan(scan);
          }
        }
      } catch {
        // Backend offline or unreachable
      }
    };

    syncScans();
    const interval = setInterval(syncScans, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Handle auto-scroll to latest log entry
  useEffect(() => {
    if (autoScroll && logViewportRef.current) {
      logViewportRef.current.scrollTop = logViewportRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Filter logs by level, source, and search query
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (selectedLevel !== 'ALL' && log.level !== selectedLevel) {
        return false;
      }
      if (selectedSource !== 'ALL' && log.source !== selectedSource) {
        return false;
      }
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const matchesMsg = log.message.toLowerCase().includes(query);
        const matchesSrc = log.source.toLowerCase().includes(query);
        const matchesLevel = log.level.toLowerCase().includes(query);
        const matchesData = log.data ? JSON.stringify(log.data).toLowerCase().includes(query) : false;
        if (!matchesMsg && !matchesSrc && !matchesLevel && !matchesData) {
          return false;
        }
      }
      return true;
    });
  }, [logs, selectedLevel, selectedSource, searchQuery]);

  // Aggregate stats
  const stats = useMemo(() => {
    let errorCount = 0;
    let warnCount = 0;
    let infoCount = 0;
    let debugCount = 0;

    for (const l of logs) {
      if (l.level === 'ERROR') errorCount++;
      else if (l.level === 'WARN') warnCount++;
      else if (l.level === 'INFO') infoCount++;
      else if (l.level === 'DEBUG') debugCount++;
    }

    return { errorCount, warnCount, infoCount, debugCount, total: logs.length };
  }, [logs]);

  // Unique sources for dropdown filter
  const sources = useMemo(() => {
    const s = new Set<string>();
    for (const l of logs) {
      s.add(l.source);
    }
    return Array.from(s).sort();
  }, [logs]);

  const handleClear = () => {
    logger.clear();
  };

  const handleCopy = () => {
    const text = logger.exportLogsAsText();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleExportJson = () => {
    const json = logger.exportLogsAsJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cerberus-debug-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSimulateLog = () => {
    const testCases: { level: LogLevel; source: string; msg: string; data?: any }[] = [
      {
        level: 'INFO',
        source: 'DiscoveryScanner',
        msg: 'Host ping sweep finished for 192.168.1.0/24 in 1.42s. 12 active hosts verified.',
        data: { targetSubnet: '192.168.1.0/24', durationMs: 1420, hostsDiscovered: 12 },
      },
      {
        level: 'WARN',
        source: 'NmapWrapper',
        msg: 'Port 445 (SMB) response latency > 350ms on host 192.168.1.45.',
        data: { ip: '192.168.1.45', port: 445, latencyMs: 382 },
      },
      {
        level: 'ERROR',
        source: 'VulnEngine',
        msg: 'CVE-2023-4911 (Looney Tunables) detected on host 192.168.1.10. CVSS score: 9.8.',
        data: { cve: 'CVE-2023-4911', cvss: 9.8, service: 'glibc-ld.so', severity: 'CRITICAL' },
      },
      {
        level: 'DEBUG',
        source: 'WailsBridge',
        msg: 'Heartbeat response received from background sentinel poller. Payload size: 488 bytes.',
        data: { cycleSec: 5, bytes: 488 },
      },
    ];
    const pick = testCases[Math.floor(Math.random() * testCases.length)];
    logger.addLog(pick.level, pick.source, pick.msg, pick.data);
  };

  return (
    <div className="debug-container">
      {/* Top Header */}
      <div className="debug-header">
        <div className="debug-title">
          <Icon name="bug_report" /> SYSTEM DEBUG & AUDIT LOGS
        </div>

        <div className="debug-header-actions">
          <button
            type="button"
            className={`btn ${autoScroll ? 'btn--accent' : 'btn--dark'}`}
            onClick={() => setAutoScroll((prev) => !prev)}
            title="Toggle live log viewport auto-scroll"
          >
            <Icon name="refresh" />
            <span>{autoScroll ? 'AUTO-SCROLL ON' : 'AUTO-SCROLL OFF'}</span>
          </button>

          <button
            type="button"
            className="btn btn--dark"
            onClick={handleCopy}
            title="Copy logs formatted as text to clipboard"
          >
            <Icon name="add" />
            <span>{copied ? 'COPIED!' : 'COPY LOGS'}</span>
          </button>

          <button
            type="button"
            className="btn btn--dark"
            onClick={handleExportJson}
            title="Export all logs as JSON payload"
          >
            <Icon name="radar" />
            <span>EXPORT JSON</span>
          </button>

          <button
            type="button"
            className="btn btn--dark"
            onClick={handleSimulateLog}
            title="Inject simulated diagnostics entry"
          >
            <Icon name="add" />
            <span>SIMULATE EVENT</span>
          </button>

          <button
            type="button"
            className="btn btn--dark"
            onClick={handleClear}
            title="Clear the local debug log buffer"
          >
            <Icon name="delete" />
            <span>CLEAR</span>
          </button>
        </div>
      </div>

      {/* Diagnostics Telemetry Strip */}
      <div className="debug-diagnostics">
        <div className="debug-diag-item">
          <span className="debug-pulse-dot" />
          <span className="debug-diag-label">Core Daemon:</span>
          <span className={`debug-diag-value ${statusError ? 'debug-diag-value--error' : 'debug-diag-value--ok'}`}>
            {statusError ? 'DISCONNECTED (HTTP 502)' : 'ACTIVE (ONLINE)'}
          </span>
        </div>

        <div className="debug-diag-divider" />

        <div className="debug-diag-item">
          <span className="debug-diag-label">Events:</span>
          <span className="debug-diag-value">
            {filteredLogs.length} / {stats.total}
          </span>
        </div>

        <div className="debug-diag-divider" />

        <div className="debug-diag-item">
          <span className="debug-diag-label">Errors:</span>
          <span className={`debug-diag-value ${stats.errorCount > 0 ? 'debug-diag-value--error' : ''}`}>
            {stats.errorCount}
          </span>
        </div>

        <div className="debug-diag-divider" />

        <div className="debug-diag-item">
          <span className="debug-diag-label">Warnings:</span>
          <span className={`debug-diag-value ${stats.warnCount > 0 ? 'debug-diag-value--warn' : ''}`}>
            {stats.warnCount}
          </span>
        </div>

        <div className="debug-diag-divider" />

        <div className="debug-diag-item">
          <span className="debug-diag-label">Uptime:</span>
          <span className="debug-diag-value">
            {status ? `${status.uptime_seconds}s` : '—'}
          </span>
        </div>

        <div className="debug-diag-divider" />

        <div className="debug-diag-item">
          <span className="debug-diag-label">Transport:</span>
          <span className="debug-diag-value">WAILS V2 IPC</span>
        </div>
      </div>

      {/* Controls: Search, Level pills, Source filter */}
      <div className="debug-controls">
        <div className="debug-search-box">
          <Icon name="search" />
          <input
            type="text"
            className="debug-search-input"
            placeholder="Filter logs by message, component, or CVE..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
              onClick={() => setSearchQuery('')}
            >
              <Icon name="close" />
            </button>
          )}
        </div>

        <div className="debug-level-pills">
          {(['ALL', 'ERROR', 'WARN', 'INFO', 'DEBUG'] as const).map((level) => {
            const count =
              level === 'ALL'
                ? stats.total
                : level === 'ERROR'
                ? stats.errorCount
                : level === 'WARN'
                ? stats.warnCount
                : level === 'INFO'
                ? stats.infoCount
                : stats.debugCount;

            return (
              <button
                key={level}
                type="button"
                className={`debug-level-pill debug-level-pill--${level.toLowerCase()} ${
                  selectedLevel === level ? 'debug-level-pill--active' : ''
                }`}
                onClick={() => setSelectedLevel(level)}
              >
                <span>{level}</span>
                <span className="debug-count-tag">{count}</span>
              </button>
            );
          })}
        </div>

        <select
          className="debug-source-select"
          value={selectedSource}
          onChange={(e) => setSelectedSource(e.target.value)}
        >
          <option value="ALL">ALL SUBSYSTEMS</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              [{s}]
            </option>
          ))}
        </select>
      </div>

      {/* Terminal Console Viewport */}
      <div className="debug-terminal">
        <div className="debug-terminal-header">
          <div className="debug-terminal-header-title">
            <Icon name="bug_report" />
            <span>CERBERUS SENTINEL REAL-TIME TELEMETRY LOGS</span>
          </div>
          <div className="debug-terminal-dots">
            <div className="debug-terminal-dot" />
            <div className="debug-terminal-dot" />
            <div className="debug-terminal-dot" />
          </div>
        </div>

        <div className="debug-logs-viewport" ref={logViewportRef}>
          {filteredLogs.length === 0 ? (
            <div className="debug-empty-state">
              <Icon name="mystery" />
              <span>No logs found matching current filter query</span>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isExpanded = expandedId === log.id;
              const hasData = Boolean(log.data);

              return (
                <div
                  key={log.id}
                  className={`debug-log-row debug-log-row--${log.level.toLowerCase()}`}
                  onClick={() => hasData && setExpandedId(isExpanded ? null : log.id)}
                  title={hasData ? 'Click to inspect structured data' : undefined}
                >
                  <div className="debug-log-row-main">
                    <span className="debug-log-time">{log.displayTime}</span>

                    <span className={`debug-log-badge debug-log-badge--${log.level.toLowerCase()}`}>
                      {log.level}
                    </span>

                    <span className="debug-log-source">[{log.source}]</span>

                    <span className="debug-log-message">{log.message}</span>

                    {hasData && (
                      <span className="debug-log-expand-icon">
                        <Icon name={isExpanded ? 'arrow_back_ios_new' : 'arrow_forward_ios'} />
                      </span>
                    )}
                  </div>

                  {isExpanded && hasData && (
                    <div className="debug-log-details">
                      <pre>{JSON.stringify(log.data, null, 2)}</pre>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
