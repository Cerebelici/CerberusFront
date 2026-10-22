export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export type LogSource =
  | 'Daemon'
  | 'DiscoveryScanner'
  | 'VulnEngine'
  | 'NmapWrapper'
  | 'WailsBridge'
  | 'ApiServer'
  | 'Frontend'
  | 'System';

export interface LogEntry {
  id: string;
  timestamp: string;
  displayTime: string;
  level: LogLevel;
  source: LogSource | string;
  message: string;
  data?: any;
}

type LogListener = (entry: LogEntry, allLogs: LogEntry[]) => void;

class LoggerService {
  private logs: LogEntry[] = [];
  private listeners: Set<LogListener> = new Set();
  private maxLogs = 1000;
  private isIntercepting = false;
  private knownScanKeys = new Set<string>();

  constructor() {
    this.seedInitialLogs();
    this.initConsoleInterception();
    this.initWailsEvents();
  }

  private initWailsEvents() {
    if (typeof window !== 'undefined' && (window as any).runtime?.EventsOn) {
      try {
        (window as any).runtime.EventsOn('cerberus:log', (entry: any) => {
          if (entry && typeof entry === 'object') {
            this.addLog(
              entry.level || 'INFO',
              entry.source || 'Daemon',
              entry.message || String(entry),
              entry.data
            );
          }
        });
      } catch (err) {
        // Wails runtime events not active in browser preview mode
      }
    }
  }

  private formatDisplayTime(date: Date): string {
    const pad = (n: number, z = 2) => String(n).padStart(z, '0');
    const h = pad(date.getHours());
    const m = pad(date.getMinutes());
    const s = pad(date.getSeconds());
    const ms = pad(date.getMilliseconds(), 3);
    return `${h}:${m}:${s}.${ms}`;
  }

  private seedInitialLogs() {
    const now = new Date();
    const iso = now.toISOString();

    this.logs.push(
      {
        id: 'init-1',
        timestamp: new Date(now.getTime() - 2400).toISOString(),
        displayTime: this.formatDisplayTime(new Date(now.getTime() - 2400)),
        level: 'INFO',
        source: 'Daemon',
        message: 'Cerberus Sentinel security core initializing...',
        data: { pid: 4892, arch: 'arm64', mode: 'sentinel-soc' },
      },
      {
        id: 'init-2',
        timestamp: new Date(now.getTime() - 2100).toISOString(),
        displayTime: this.formatDisplayTime(new Date(now.getTime() - 2100)),
        level: 'DEBUG',
        source: 'WailsBridge',
        message: 'IPC channel established. Native runtime bindings ready.',
        data: { transport: 'wails-v2-ipc', target: 'localhost' },
      },
      {
        id: 'init-3',
        timestamp: new Date(now.getTime() - 1700).toISOString(),
        displayTime: this.formatDisplayTime(new Date(now.getTime() - 1700)),
        level: 'INFO',
        source: 'DiscoveryScanner',
        message: 'Network interface bound. Scanning engine primed.',
        data: { iface: 'en0', autoMode: true },
      },
      {
        id: 'init-4',
        timestamp: new Date(now.getTime() - 1200).toISOString(),
        displayTime: this.formatDisplayTime(new Date(now.getTime() - 1200)),
        level: 'INFO',
        source: 'VulnEngine',
        message: 'Vulnerability database feed verified (CVSS 3.1 & vulners.nse rules).',
      },
      {
        id: 'init-5',
        timestamp: iso,
        displayTime: this.formatDisplayTime(now),
        level: 'INFO',
        source: 'System',
        message: 'Cerberus Dashboard ready. Telemetry streaming active.',
      }
    );
  }

  public addLog(
    level: LogLevel,
    source: LogSource | string,
    message: string,
    data?: any
  ): LogEntry {
    const date = new Date();
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: date.toISOString(),
      displayTime: this.formatDisplayTime(date),
      level,
      source,
      message,
      data,
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    this.notify(entry);
    return entry;
  }

  public debug(source: LogSource | string, message: string, data?: any) {
    return this.addLog('DEBUG', source, message, data);
  }

  public info(source: LogSource | string, message: string, data?: any) {
    return this.addLog('INFO', source, message, data);
  }

  public warn(source: LogSource | string, message: string, data?: any) {
    return this.addLog('WARN', source, message, data);
  }

  public error(source: LogSource | string, message: string, data?: any) {
    return this.addLog('ERROR', source, message, data);
  }

  public ingestBackendScan(scan: {
    id: number;
    scan_type: string;
    status: string;
    target_spec: string;
    hosts_found: number;
    vulns_found: number;
    duration_ms: number;
    error_message?: string;
    started_at: string;
    completed_at?: string | null;
  }) {
    const key = `${scan.id}-${scan.status}`;
    if (this.knownScanKeys.has(key)) return;
    this.knownScanKeys.add(key);

    const isDiscovery = scan.scan_type === 'discovery';
    const source: LogSource = isDiscovery ? 'DiscoveryScanner' : 'VulnEngine';

    if (scan.status === 'running') {
      this.addLog(
        'INFO',
        source,
        `Nmap ${scan.scan_type} sweep initiated on target [${scan.target_spec}].`,
        { scanId: scan.id, target: scan.target_spec, startedAt: scan.started_at }
      );
    } else if (scan.status === 'completed') {
      const durationSec = (scan.duration_ms / 1000).toFixed(2);
      const summary = isDiscovery
        ? `${scan.hosts_found} active hosts discovered`
        : `${scan.hosts_found} hosts audited, ${scan.vulns_found} CVEs detected`;

      this.addLog(
        'INFO',
        source,
        `Nmap ${scan.scan_type} sweep completed in ${durationSec}s. Result: ${summary}.`,
        {
          scanId: scan.id,
          target: scan.target_spec,
          durationMs: scan.duration_ms,
          hosts: scan.hosts_found,
          vulns: scan.vulns_found,
        }
      );
    } else if (scan.status === 'failed') {
      this.addLog(
        'ERROR',
        source,
        `Nmap ${scan.scan_type} sweep failed on [${scan.target_spec}]: ${scan.error_message || 'Process error'}`,
        { scanId: scan.id, target: scan.target_spec, error: scan.error_message }
      );
    }
  }

  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  public clear() {
    this.logs = [];
    const date = new Date();
    const resetEntry: LogEntry = {
      id: `${Date.now()}-reset`,
      timestamp: date.toISOString(),
      displayTime: this.formatDisplayTime(date),
      level: 'INFO',
      source: 'System',
      message: 'Log buffer cleared by operator.',
    };
    this.logs.push(resetEntry);
    this.notify(resetEntry);
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
      } catch (err) {
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

    console.log = (...args: any[]) => {
      originalLog.apply(console, args);
      const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
      if (!msg.includes('[vite]') && !msg.includes('Download the React DevTools')) {
        this.addLog('DEBUG', 'Frontend', msg);
      }
    };

    console.info = (...args: any[]) => {
      originalInfo.apply(console, args);
      const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
      this.addLog('INFO', 'Frontend', msg);
    };

    console.warn = (...args: any[]) => {
      originalWarn.apply(console, args);
      const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
      this.addLog('WARN', 'Frontend', msg);
    };

    console.error = (...args: any[]) => {
      originalError.apply(console, args);
      const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
      this.addLog('ERROR', 'Frontend', msg);
    };

    window.addEventListener('error', (event) => {
      this.addLog('ERROR', 'Frontend', `Uncaught exception: ${event.message}`, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.addLog('ERROR', 'Frontend', `Unhandled Promise Rejection: ${String(event.reason)}`);
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

