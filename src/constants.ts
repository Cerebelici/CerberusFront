export const ROUTES = {
    HOME: '/',
    DEVICES: '/devices',
    SERVICES: '/services',
    VULNERABILITIES: '/vulnerabilities',
    SCANS: '/scans',
} as const;

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'none';

// export const FONTS = {
//     DISPLAY: "'Share Tech Mono:Regular', monospace",
//     BODY: "'IBM Plex Mono:Medium', monospace",
// } as const; 