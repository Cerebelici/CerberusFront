export const ROUTES = {
    HOME: '/',
    DEVICES: '/devices',
    SERVICES: '/services',
    VULNERABILITIES: '/vulnerabilities',
    SCANS: '/scans',
    SETTINGS: '/settings',
} as const;

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'none';

/** CVSS-style lower bounds (inclusive) for each severity rank on a 0–10 scale. */
export const SEVERITY_THRESHOLDS = {
    critical: 9.0,
    high: 7.0,
    medium: 4.0,
} as const;

/** Display order for severity breakdowns (most severe first). */
export const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'] as const satisfies readonly Severity[];

export const SEVERITY_LABELS: Record<Severity, string> = {
    critical: 'CRITICAL',
    high: 'HIGH',
    medium: 'MEDIUM',
    low: 'LOW',
    none: 'NONE',
};

/** Maps a 0–10 risk/CVSS score to a severity rank. */
export function severityFromScore(score: number): Severity {
    if (score >= SEVERITY_THRESHOLDS.critical) return 'critical';
    if (score >= SEVERITY_THRESHOLDS.high) return 'high';
    if (score >= SEVERITY_THRESHOLDS.medium) return 'medium';
    if (score > 0) return 'low';
    return 'none';
}

/** localStorage keys for persisted table filter/sort state. Bump the version suffix on schema changes. */
export const TABLE_STORAGE_KEYS = {
    DEVICES: 'pigeons-are-drones:devices-table:v1',
    SERVICES: 'pigeons-are-drones:services-table:v1',
    VULNERABILITIES: 'pigeons-are-drones:vulnerabilities-table:v1',
    SCANS: 'pigeons-are-drones:scans-table:v1',
} as const;

// export const FONTS = {
//     DISPLAY: "'Share Tech Mono:Regular', monospace",
//     BODY: "'IBM Plex Mono:Medium', monospace",
// } as const;
