import './Home.css';
import DonutChart from '../DonutChart/DonutChart';
import BarChart  from '../BarChart/BarChart';
import { NetworkTimeline, type NetworkData } from '../Timeline/Timeline';
import type { BarDataItem } from '../BarChart/BarChart';
import type { Severity } from '../../constants';
import { NavLink } from 'react-router-dom';
import { ROUTES, SEVERITY_LABELS, SEVERITY_ORDER, severityFromScore } from '../../constants';
import { useEffect, useMemo, useState } from 'react';
import { useUptime, formatDate } from '../../uptime';
import { useApiResource } from '../../hooks/useApiResource';
import { fetchDevices, fetchServices, fetchVulnerabilities } from '../../api/inventory';
import { fetchPosture } from '../../api/system';
import type { PostureReportDTO, ServiceDTO, VulnerabilityDTO } from '../../api/types';
import { useSystemStatus } from '../../state/useSystemStatus';
import type { ScanType } from '../scan';
import timelineMockJson from '../../../timelinemock3.json?raw';

type VulnerabilityStat = {
  severity: Severity;
  label: string;
  count: number;
};

type ScanWidgetsInfo = {
  type: ScanType;
  route: string;
  time: string;
};

// Timeline data source toggle (upstream f74335d) — intentionally left as-is.
const use_mock_data = true;

const PLACEHOLDER = '—';

// Fleet health is reported on a 0–100 scale (100 = healthy). The donut shows the
// complementary 0–10 risk so it lines up with CVSS-style severity ranks.
const RISK_SCALE_MAX = 10;

function fleetRiskScore(posture: PostureReportDTO | null): number {
  if (!posture || posture.fleet_score === null) return 0;
  const risk = (100 - posture.fleet_score) / (100 / RISK_SCALE_MAX);
  return Math.min(RISK_SCALE_MAX, Math.max(0, Math.round(risk * 100) / 100));
}

function countBySeverity(openVulns: readonly VulnerabilityDTO[]): VulnerabilityStat[] {
  return SEVERITY_ORDER.map((severity) => ({
    severity,
    label: SEVERITY_LABELS[severity],
    count: openVulns.filter((vuln) => vuln.severity.toLowerCase() === severity).length,
  }));
}

function compromisedServiceCount(services: readonly ServiceDTO[], openVulns: readonly VulnerabilityDTO[]): number {
  const vulnerablePorts = new Set(openVulns.map((vuln) => `${vuln.device_id}:${vuln.service_port}`));
  return services.filter(
    (service) => service.state === 'open' && vulnerablePorts.has(`${service.device_id}:${service.port}`),
  ).length;
}

// Picks a y-axis step that keeps the 5 BarChart ticks integral and the bars readable
// for anything from a lab subnet (a handful of hosts) to a large estate.
const BAR_CHART_STEPS = [4, 8, 20, 40, 100, 200, 400, 1000, 2000, 4000, 10000] as const;
function barChartStep(data: readonly BarDataItem[]): number {
  const peak = Math.max(0, ...data.map((item) => item.value));
  return BAR_CHART_STEPS.find((step) => peak <= step) ?? Math.ceil(peak / 4) * 4;
}

function nextRunLabel(nextRun: string | null | undefined, running: boolean): string {
  if (running) return 'RUNNING';
  return nextRun ? formatDate(nextRun) : PLACEHOLDER;
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

function Home() {
  const [timelineData, setTimelineData] = useState<NetworkData | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [timelineError, setTimelineError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    Promise.resolve()
      .then(() => use_mock_data
        ? getMockTimeline()
        : getTimeline(controller.signal))
      .then(setTimelineData)
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        setTimelineError(error instanceof Error ? error.message : 'Could not load timeline');
      })
      .finally(() => setTimelineLoading(false));

    return () => controller.abort();
  }, []);

  // Live dashboard data. Everything re-fetches automatically when a scan finishes.
  const { status, error: statusError, backendStartedAt, scanGeneration } = useSystemStatus();
  const posture = useApiResource(fetchPosture, scanGeneration);
  const devices = useApiResource(fetchDevices, scanGeneration);
  const services = useApiResource(fetchServices, scanGeneration);
  const vulnerabilities = useApiResource(fetchVulnerabilities, scanGeneration);

  const openVulns = useMemo(
    () => (vulnerabilities.data ?? []).filter((vuln) => vuln.status === 'open'),
    [vulnerabilities.data],
  );

  const vulnerabilityScore = fleetRiskScore(posture.data);
  const severityRank: Severity = severityFromScore(vulnerabilityScore);
  const vulnerabilityTotal = vulnerabilities.data ? openVulns.length : status?.total_vulnerabilities ?? null;
  const vulnerabilityStats = useMemo(() => countBySeverity(openVulns), [openVulns]);

  const barChartDataDevices = useMemo<BarDataItem[]>(() => {
    const list = devices.data ?? [];
    return [
      { label: 'TOTAL', value: devices.data ? list.length : status?.total_devices ?? 0 },
      { label: 'ONLINE', value: devices.data ? list.filter((d) => d.status === 'up').length : status?.active_devices ?? 0 },
      { label: 'COMPROMISED', value: list.filter((d) => (d.vulnerabilities_count ?? 0) > 0).length },
    ];
  }, [devices.data, status?.total_devices, status?.active_devices]);

  const barChartDataServices = useMemo<BarDataItem[]>(() => {
    const list = services.data ?? [];
    return [
      { label: 'TOTAL', value: list.length },
      { label: 'OPEN', value: services.data ? list.filter((s) => s.state === 'open').length : status?.total_services ?? 0 },
      { label: 'COMPROMISED', value: compromisedServiceCount(list, openVulns) },
    ];
  }, [services.data, openVulns, status?.total_services]);

  const scanWidgetsInfo: ScanWidgetsInfo[] = [
    {
      type: 'discovery',
      route: `${ROUTES.SCANS}?type=discovery`,
      time: nextRunLabel(status?.discovery_next_run, status?.is_discovery_running ?? false),
    },
    {
      type: 'vulnerability',
      route: `${ROUTES.SCANS}?type=vulnerability`,
      time: nextRunLabel(status?.vuln_next_run, status?.is_vuln_running ?? false),
    },
  ];

  // Backend process start time, derived from the reported uptime.
  const activeSince = backendStartedAt;
  const uptimeDisplay = useUptime(activeSince ?? 0);
  const activeSinceFormated = activeSince ? formatDate(activeSince) : PLACEHOLDER;

  const dataErrors = [statusError, posture.error, devices.error, services.error, vulnerabilities.error]
    .filter((message): message is string => message !== null);

  return (
    <div className='dashboard-shell'>
      {dataErrors.length > 0 && (
        <div className='dashboard__errors' role='alert'>
          {[...new Set(dataErrors)].map((message) => <p key={message}>{message}</p>)}
        </div>
      )}
      <div className='dashboard'>
          {/* Row 1 */}
          <div className='widget widget--vuln-score'>
            <DonutChart score={vulnerabilityScore} maxScore={RISK_SCALE_MAX} rank={severityRank}/>
          </div>

          <div className='widget widget--vuln-stats'>
            <div className='vuln-stats__list'>
              <div className='vuln-stats__item vuln-stats__item--header'>
                <p className='vuln-stats__item__score'>{vulnerabilityTotal ?? PLACEHOLDER}</p>
                <p className='vuln-stats__item__label'>Total vulnerabilities</p>
              </div>
              {vulnerabilityStats.map((item) => {
                  return(
                    <div key={item.severity} className={`vuln-stats__item vuln-stats__item--${item.severity}`}>
                      <p className='vuln-stats__item__score'>{vulnerabilities.data ? item.count : PLACEHOLDER}</p>
                      <p className='vuln-stats__item__label'>{item.label}</p>
                    </div>
                  )
                })
              }
            </div>
          </div>

          <div className='widget widget--uptime-scans'>
              {/* Top row */}
              <div className='widget uptime-scans__uptime'>
                <div className='uptime-scans__uptime__wrap'>
                  <p className='uptime-scans__uptime__title'>TOTAL UPTIME</p>
                  <p className='uptime-scans__uptime__countdown'>{activeSince ? uptimeDisplay : PLACEHOLDER}</p>
                </div>
                <p className='uptime-scans__uptime__label'>
                  Active since: <span className='uptime-scans__uptime__time' >{activeSinceFormated}</span>
                </p>
              </div>
              {/* Bottom row (2 widgets!)*/}
              {scanWidgetsInfo.map((item) => {
                return(
                  <div key={item.type} className={`widget uptime-scans__scans uptime-scans__scans--${item.type}`}>
                    <p className='uptime-scans__scans__label'>Next {item.type} scan:</p>
                    <p className='uptime-scans__scans__time'>{item.time}</p>
                    <NavLink to={item.route} className='btn btn--light uptime-scans__scans__button'>Go to scans</NavLink>
                  </div>
                )
              })}
          </div>

          {/* Row 2 */}
          <div className='widget widget--devices-chart'>
            <BarChart title='Devices' data={barChartDataDevices} step={barChartStep(barChartDataDevices)}/>
          </div>
          <div className='widget widget--services-chart'>
            <BarChart title='Services' data={barChartDataServices} step={barChartStep(barChartDataServices)}/>
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
  )
}

export default Home
