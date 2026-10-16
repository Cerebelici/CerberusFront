import './Home.css';
import DonutChart from '../DonutChart/DonutChart';
import BarChart from '../BarChart/BarChart';
import { NetworkTimeline, type NetworkData } from '../Timeline/Timeline';
import type { BarDataItem } from '../BarChart/BarChart';
import type { Severity } from '../../constants';
import { NavLink } from 'react-router-dom';
import { ROUTES } from '../../constants';
import { useEffect, useState, useMemo } from 'react';
import { useUptime, formatDate } from '../../uptime';
import timelineMockJson from '../../../timelinemock3.json?raw';

const use_mock_data = false;

type VulnerabilityStat = {
  severity: Severity;
  label: string;
  count: number;
};

type ScanType = 'discovery' | 'vulnerability';

type ScanWidgetsInfo = {
  type: ScanType;
  route: string;
  time: string;
};

interface SystemStatus {
  uptime?: string;
  uptime_seconds?: number;
  active_devices?: number;
  total_devices?: number;
  total_services?: number;
  total_vulnerabilities?: number;
  discovery_next_run?: string;
  vuln_next_run?: string;
  is_discovery_running?: boolean;
  is_vuln_running?: boolean;
  fleet_score?: number;
}

interface PostureReport {
  fleet_score?: number | null;
  mean_risk?: number;
  max_risk?: number;
}

interface DeviceItem {
  id: number;
  status: 'up' | 'down';
  vulnerabilities_count?: number;
  risk?: number;
}

interface ServiceItem {
  id: number;
  device_id: number;
  port: number;
  state: 'open' | 'closed';
}

interface VulnerabilityItem {
  id: number;
  device_id: number;
  service_port?: number;
  severity: string;
  cvss_score: number;
}

function parseTimeline(body: unknown): NetworkData {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('time_window' in body) ||
    typeof body.time_window !== 'object' ||
    body.time_window === null ||
    !('scan_ticks' in body) ||
    !Array.isArray(body.scan_ticks) ||
    !('devices' in body) ||
    !Array.isArray(body.devices)
  ) {
    throw new Error('The timeline data is invalid');
  }

  return body as NetworkData;
}

async function getTimeline(signal?: AbortSignal): Promise<NetworkData> {
  const response = await fetch('/api/timeline', {
    method: 'GET',
    signal,
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
  });

  if (!response.ok) {
    throw new Error(`Could not load timeline (HTTP ${response.status})`);
  }

  return parseTimeline(await response.json());
}

function getMockTimeline(): NetworkData {
  return parseTimeline(JSON.parse(timelineMockJson) as unknown);
}

function calculateSeverityRank(score: number): Severity {
  if (score >= 9.0) return 'critical';
  if (score >= 7.0) return 'high';
  if (score >= 4.0) return 'medium';
  if (score > 0) return 'low';
  return 'none';
}

function Home() {
  const [timelineData, setTimelineData] = useState<NetworkData | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [timelineError, setTimelineError] = useState<string | null>(null);

  const [activeSince, setActiveSince] = useState<string | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [posture, setPosture] = useState<PostureReport | null>(null);
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [vulnerabilities, setVulnerabilities] = useState<VulnerabilityItem[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    (use_mock_data ? Promise.resolve(getMockTimeline()) : getTimeline(signal))
      .then(setTimelineData)
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        setTimelineError(error instanceof Error ? error.message : 'Could not load timeline');
      })
      .finally(() => setTimelineLoading(false));

    // Fetch real metrics for the dashboard widgets
    const fetchDashboardMetrics = async () => {
      try {
        const [statusRes, postureRes, devicesRes, servicesRes, vulnsRes] = await Promise.allSettled([
          fetch('/api/status', { signal, headers: { Accept: 'application/json' } }),
          fetch('/api/posture', { signal, headers: { Accept: 'application/json' } }),
          fetch('/api/devices', { signal, headers: { Accept: 'application/json' } }),
          fetch('/api/services', { signal, headers: { Accept: 'application/json' } }),
          fetch('/api/vulnerabilities', { signal, headers: { Accept: 'application/json' } }),
        ]);

        if (statusRes.status === 'fulfilled' && statusRes.value.ok) {
          const data = (await statusRes.value.json()) as SystemStatus;
          setSystemStatus(data);
          if (typeof data.uptime_seconds === 'number') {
            setActiveSince(new Date(Date.now() - data.uptime_seconds * 1000).toISOString());
          }
        }

        if (postureRes.status === 'fulfilled' && postureRes.value.ok) {
          const data = (await postureRes.value.json()) as PostureReport;
          setPosture(data);
        }

        if (devicesRes.status === 'fulfilled' && devicesRes.value.ok) {
          const data = (await devicesRes.value.json()) as { devices?: DeviceItem[] };
          if (Array.isArray(data.devices)) setDevices(data.devices);
        }

        if (servicesRes.status === 'fulfilled' && servicesRes.value.ok) {
          const data = (await servicesRes.value.json()) as { services?: ServiceItem[] };
          if (Array.isArray(data.services)) setServices(data.services);
        }

        if (vulnsRes.status === 'fulfilled' && vulnsRes.value.ok) {
          const data = (await vulnsRes.value.json()) as { vulnerabilities?: VulnerabilityItem[] };
          if (Array.isArray(data.vulnerabilities)) setVulnerabilities(data.vulnerabilities);
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') return;
      }
    };

    void fetchDashboardMetrics();
    const intervalId = window.setInterval(() => void fetchDashboardMetrics(), 30_000);

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, []);

  // Vulnerability Score: from live posture mean_risk or derived from fleet_score
  const vulnerabilityScore = useMemo(() => {
    if (typeof posture?.mean_risk === 'number') {
      return posture.mean_risk;
    }
    if (typeof posture?.fleet_score === 'number') {
      return Math.max(0, (100 - posture.fleet_score) / 10);
    }
    if (typeof systemStatus?.fleet_score === 'number') {
      return Math.max(0, (100 - systemStatus.fleet_score) / 10);
    }
    return 0;
  }, [posture, systemStatus]);

  const severityRank = useMemo(() => calculateSeverityRank(vulnerabilityScore), [vulnerabilityScore]);

  // Vulnerability Totals and breakdown by severity
  const vulnerabilityTotal = systemStatus?.total_vulnerabilities ?? vulnerabilities.length;

  const vulnerabilityStats: VulnerabilityStat[] = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const v of vulnerabilities) {
      const sev = v.severity?.toLowerCase();
      if (sev === 'critical') counts.critical++;
      else if (sev === 'high') counts.high++;
      else if (sev === 'medium') counts.medium++;
      else if (sev === 'low') counts.low++;
    }

    return [
      { severity: 'critical', label: 'CRITICAL', count: counts.critical },
      { severity: 'high', label: 'HIGH', count: counts.high },
      { severity: 'medium', label: 'MEDIUM', count: counts.medium },
      { severity: 'low', label: 'LOW', count: counts.low },
    ];
  }, [vulnerabilities]);

  const uptimeDisplay = useUptime(activeSince);
  const activeSinceFormated = formatDate(activeSince);

  // Next Scans Widget info
  const scanWidgetsInfo: ScanWidgetsInfo[] = useMemo(() => [
    {
      type: 'discovery',
      route: ROUTES.SCANS,
      time: systemStatus?.is_discovery_running
        ? 'Scanning...'
        : formatDate(systemStatus?.discovery_next_run),
    },
    {
      type: 'vulnerability',
      route: ROUTES.SCANS,
      time: systemStatus?.is_vuln_running
        ? 'Scanning...'
        : formatDate(systemStatus?.vuln_next_run),
    },
  ], [systemStatus]);

  // Devices bar chart data
  const barChartDataDevices: BarDataItem[] = useMemo(() => {
    const total = devices.length > 0 ? devices.length : (systemStatus?.total_devices ?? 0);
    const open = devices.length > 0
      ? devices.filter((d) => d.status === 'up').length
      : (systemStatus?.active_devices ?? 0);
    const compromised = devices.filter(
      (d) => (d.vulnerabilities_count ?? 0) > 0 || (d.risk ?? 0) > 0
    ).length;

    return [
      { label: 'TOTAL', value: total },
      { label: 'OPEN', value: open },
      { label: 'COMPROMISED', value: compromised },
    ];
  }, [devices, systemStatus]);

  // Services bar chart data
  const barChartDataServices: BarDataItem[] = useMemo(() => {
    const total = services.length > 0 ? services.length : (systemStatus?.total_services ?? 0);
    const open = services.filter((s) => s.state === 'open').length;

    const compromisedServicePorts = new Set(
      vulnerabilities.filter((v) => v.service_port).map((v) => `${v.device_id}:${v.service_port}`)
    );
    const vulnerableDeviceIds = new Set(vulnerabilities.map((v) => v.device_id));

    const compromised = services.filter((s) => {
      if (compromisedServicePorts.has(`${s.device_id}:${s.port}`)) return true;
      if (vulnerableDeviceIds.has(s.device_id) && s.state === 'open') return true;
      return false;
    }).length;

    return [
      { label: 'TOTAL', value: total },
      { label: 'OPEN', value: open },
      { label: 'COMPROMISED', value: compromised },
    ];
  }, [services, systemStatus, vulnerabilities]);

  return (
    <div className='dashboard-shell'>
      <div className='dashboard'>
        {/* Row 1 */}
        <div className='widget widget--vuln-score'>
          <DonutChart score={vulnerabilityScore} maxScore={10} rank={severityRank} />
        </div>

        <div className='widget widget--vuln-stats'>
          <div className='vuln-stats__list'>
            <div className='vuln-stats__item vuln-stats__item--header'>
              <p className='vuln-stats__item__score'>{vulnerabilityTotal}</p>
              <p className='vuln-stats__item__label'>Total vulnerabilities</p>
            </div>
            {vulnerabilityStats.map((item) => (
              <div key={item.severity} className={`vuln-stats__item vuln-stats__item--${item.severity}`}>
                <p className='vuln-stats__item__score'>{item.count}</p>
                <p className='vuln-stats__item__label'>{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className='widget widget--uptime-scans'>
          {/* Top row */}
          <div className='widget uptime-scans__uptime'>
            <div className='uptime-scans__uptime__wrap'>
              <p className='uptime-scans__uptime__title'>TOTAL UPTIME</p>
              <p className='uptime-scans__uptime__countdown'>{uptimeDisplay}</p>
            </div>
            <p className='uptime-scans__uptime__label'>
              Active since: <span className='uptime-scans__uptime__time'>{activeSinceFormated}</span>
            </p>
          </div>
          {/* Bottom row (2 widgets!) */}
          {scanWidgetsInfo.map((item) => (
            <div key={item.type} className={`widget uptime-scans__scans uptime-scans__scans--${item.type}`}>
              <p className='uptime-scans__scans__label'>Next {item.type} scan:</p>
              <p className='uptime-scans__scans__time'>{item.time}</p>
              <NavLink to={item.route} className='btn btn--light uptime-scans__scans__button'>
                Go to scans
              </NavLink>
            </div>
          ))}
        </div>

        {/* Row 2 */}
        <div className='widget widget--devices-chart'>
          <BarChart title='Devices' data={barChartDataDevices} />
        </div>
        <div className='widget widget--services-chart'>
          <BarChart title='Services' data={barChartDataServices} />
        </div>

        {/* Row 3 */}
        <div className='widget widget--timeline'>
          {timelineLoading ? (
            <p>Loading timeline...</p>
          ) : timelineError ? (
            <p role='alert'>{timelineError}</p>
          ) : timelineData ? (
            <NetworkTimeline data={timelineData} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default Home;