import { useState, useEffect, useRef, useMemo } from 'react';
import './DebugLogs.css';
import { Icon } from '../Icon/Icon';
import { logger, type LogEntry } from '../../services/logger';
import { useSystemStatus } from '../../state/useSystemStatus';
import { errorMessage, isAbortError } from '../../api/client';
import { isWailsApp } from '../../api/wailsBridge';

// The desktop app pushes new daemon lines as events; over HTTP the page polls for them.
const HTTP_LOG_POLL_MS = 3000;

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
}

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

  // Load the daemon log kept by the backend, then follow new lines.
  const [syncError, setSyncError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let timer: number | undefined;

    const sync = async () => {
      try {
        await logger.syncBackendLogs(controller.signal);
        setSyncError(null);
      } catch (reason: unknown) {
        if (isAbortError(reason)) return;
        setSyncError(errorMessage(reason, 'Could not load the daemon log'));
      }
      if (!controller.signal.aborted && !isWailsApp()) {
        timer = window.setTimeout(() => void sync(), HTTP_LOG_POLL_MS);
      }
    };

    void sync();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
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
            <Icon name="content_copy" />
            <span>{copied ? 'COPIED!' : 'COPY LOGS'}</span>
          </button>

          <button
            type="button"
            className="btn btn--dark"
            onClick={handleExportJson}
            title="Export all logs as JSON payload"
          >
            <Icon name="download" />
            <span>EXPORT JSON</span>
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
          <span
            className={`debug-diag-value ${statusError ? 'debug-diag-value--error' : status ? 'debug-diag-value--ok' : ''}`}
            title={statusError ?? undefined}
          >
            {statusError ? 'DISCONNECTED' : status ? 'ACTIVE (ONLINE)' : 'CONNECTING…'}
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
            {status ? formatUptime(status.uptime_seconds) : '—'}
          </span>
        </div>

        <div className="debug-diag-divider" />

        <div className="debug-diag-item">
          <span className="debug-diag-label">Transport:</span>
          <span className="debug-diag-value">{isWailsApp() ? 'WAILS IPC' : 'HTTP API'}</span>
        </div>
      </div>

      {syncError && (
        <div className="debug-sync-error" role="alert">
          <Icon name="report" />
          <span>{syncError}</span>
        </div>
      )}

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
