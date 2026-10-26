import { apiRequest } from '../api/client';
import { isRecord } from '../api/validators';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export type LogSource =
  | 'DiscoveryScanner'
  | 'VulnEngine'
  | 'Frontend'
  | 'System';

export interface LogEntry {
  id: string;
  timestamp: string;
  displayTime: string;
  level: LogLevel;
  source: LogSource | string;
  message: string;
  data?: unknown;
}

/** One line of the daemon log (GET /api/logs, desktop event "cerberus:log"). */
interface BackendLogEntry {
  seq: number;
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
}

type LogListener = (entry: LogEntry, allLogs: LogEntry[]) => void;

const LOG_LEVELS: readonly LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR'];

function isBackendLogEntry(value: unknown): value is BackendLogEntry {
  return (
    isRecord(value) &&
    typeof value.seq === 'number' &&
    typeof value.timestamp === 'string' &&
    typeof value.level === 'string' &&
    (LOG_LEVELS as readonly string[]).includes(value.level) &&
    typeof value.source === 'string' &&
    typeof value.message === 'string'
  );
}

function parseBackendLogs(body: unknown): BackendLogEntry[] {
  if (!isRecord(body) || !Array.isArray(body.logs)) {
    throw new TypeError('Invalid logs payload');
  }
  return body.logs.filter(isBackendLogEntry);
}

function stringify(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

class LoggerService {
  private logs: LogEntry[] = [];
  private listeners: Set<LogListener> = new Set();
  private maxLogs = 2000;
  private isIntercepting = false;
  /** Daemon lines already in the buffer, keyed by sequence number and timestamp. */
  private seenBackendLines = new Set<string>();

  constructor() {
    this.initConsoleInterception();
    this.initDesktopLogEvents();
  }

  /** Desktop app: the daemon pushes every new log line as a "cerberus:log" event. */
  private initDesktopLogEvents() {
    if (typeof window === 'undefined' || !window.runtime?.EventsOn) return;
    window.runtime.EventsOn('cerberus:log', (entry: unknown) => {
      if (isBackendLogEntry(entry)) this.ingestBackendLogs([entry]);
    });
  }

  private formatDisplayTime(date: Date): string {
    const pad = (n: number, z = 2) => String(n).padStart(z, '0');
    const h = pad(date.getHours());
    const m = pad(date.getMinutes());
    const s = pad(date.getSeconds());
    const ms = pad(date.getMilliseconds(), 3);
    return `${h}:${m}:${s}.${ms}`;
  }

  private createEntry(level: LogLevel, source: string, message: string, date: Date, id: string, data?: unknown): LogEntry {
    return {
      id,
      timestamp: date.toISOString(),
      displayTime: this.formatDisplayTime(date),
      level,
      source,
      message,
      data,
    };
  }

  private push(entry: LogEntry) {
    this.logs.push(entry);
    this.trim();
  }

  private trim() {
    if (this.logs.length > this.maxLogs) {
      this.logs.splice(0, this.logs.length - this.maxLogs);
    }
  }

  public addLog(
    level: LogLevel,
    source: LogSource | string,
    message: string,
    data?: unknown
  ): LogEntry {
    const date = new Date();
    const entry = this.createEntry(level, source, message, date, `ui-${date.getTime()}-${Math.random().toString(36).substring(2, 7)}`, data);
    this.push(entry);
    this.notify(entry);
    return entry;
  }

  public debug(source: LogSource | string, message: string, data?: unknown) {
    return this.addLog('DEBUG', source, message, data);
  }

  public info(source: LogSource | string, message: string, data?: unknown) {
    return this.addLog('INFO', source, message, data);
  }

  public warn(source: LogSource | string, message: string, data?: unknown) {
    return this.addLog('WARN', source, message, data);
  }

  public error(source: LogSource | string, message: string, data?: unknown) {
    return this.addLog('ERROR', source, message, data);
  }

  /**
   * Adds daemon log lines that are not in the buffer yet, with their backend timestamps.
   * History and live events can arrive in any order, so the buffer is kept in time order.
   */
  public ingestBackendLogs(entries: readonly BackendLogEntry[]) {
    let last: LogEntry | null = null;
    for (const e of entries) {
      // The timestamp makes the key unique across daemon restarts, which restart the sequence.
      const key = `${e.seq}@${e.timestamp}`;
      if (this.seenBackendLines.has(key)) continue;
      this.seenBackendLines.add(key);
      const date = new Date(e.timestamp);
      last = this.createEntry(e.level, e.source, e.message, Number.isNaN(date.getTime()) ? new Date() : date, `daemon-${key}`);
      this.logs.push(last);
    }
    if (!last) return;

    this.logs.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    this.trim();
    this.notify(last);
  }

  /** Loads the daemon log kept by the backend (GET /api/logs or the desktop GetLogs call). */
  public async syncBackendLogs(signal?: AbortSignal): Promise<void> {
    const entries = await apiRequest('/api/logs', { signal, resource: 'daemon log', parse: parseBackendLogs });
    this.ingestBackendLogs(entries);
  }

  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  public clear() {
    this.logs = [];
    // Keep seenBackendLines, so a later sync does not bring the cleared lines back.
    const entry = this.createEntry('INFO', 'System', 'Log buffer cleared by operator.', new Date(), `ui-${Date.now()}-reset`);
    this.push(entry);
    this.notify(entry);
  }

  public subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(entry: LogEntry) {
    for (const listener of this.listeners) {
      try {
        listener(entry, this.logs);
      } catch {
        // Prevent subscriber errors from bubbling
      }
    }
  }

  public initConsoleInterception() {
    if (this.isIntercepting || typeof window === 'undefined') return;
    this.isIntercepting = true;

    const originalLog = console.log;
    const originalInfo = console.info;
    const originalWarn = console.warn;
    const originalError = console.error;

    console.log = (...args: unknown[]) => {
      originalLog.apply(console, args);
      const msg = args.map(stringify).join(' ');
      if (!msg.includes('[vite]') && !msg.includes('Download the React DevTools')) {
        this.addLog('DEBUG', 'Frontend', msg);
      }
    };

    console.info = (...args: unknown[]) => {
      originalInfo.apply(console, args);
      this.addLog('INFO', 'Frontend', args.map(stringify).join(' '));
    };

    console.warn = (...args: unknown[]) => {
      originalWarn.apply(console, args);
      this.addLog('WARN', 'Frontend', args.map(stringify).join(' '));
    };

    console.error = (...args: unknown[]) => {
      originalError.apply(console, args);
      this.addLog('ERROR', 'Frontend', args.map(stringify).join(' '));
    };

    window.addEventListener('error', (event) => {
      this.addLog('ERROR', 'Frontend', `Uncaught exception: ${event.message}`, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.addLog('ERROR', 'Frontend', `Unhandled Promise Rejection: ${stringify(event.reason)}`);
    });
  }

  public exportLogsAsText(): string {
    return this.logs
      .map(
        (l) =>
          `[${l.timestamp}] [${l.level.padEnd(5)}] [${l.source}] ${l.message}${
            l.data ? ' ' + JSON.stringify(l.data) : ''
          }`
      )
      .join('\n');
  }

  public exportLogsAsJson(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

export const logger = new LoggerService();
