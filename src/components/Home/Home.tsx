import './Home.css';
import DonutChart from '../DonutChart/DonutChart';
import BarChart  from '../BarChart/BarChart';
import { NetworkTimeline, type NetworkData } from '../Timeline/Timeline';
import type { BarDataItem } from '../BarChart/BarChart';
import type { Severity } from '../../constants';
import { NavLink } from 'react-router-dom';
import { ROUTES } from '../../constants';
import { useEffect, useState } from 'react';
import { useUptime, formatDate } from '../../uptime';

const vulnerabilityScore: number = 7.3 //placeholder

const vulnerabilityTotal: number = 267 //placeholder

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

const vulnerabilityStats: VulnerabilityStat[] = [
  { severity: 'critical', label: "CRITICAL", count: 32 },
  { severity: 'high',  label: "HIGH",count: 12 },
  { severity: 'medium', label: "MEDIUM",count: 47 },
  { severity: 'low', label: "LOW",count: 176 },
];

const scanWidgetsInfo: ScanWidgetsInfo[] = [
  { type: 'discovery', route: ROUTES.SCANS, time: "11/09/26 11:32" }, //todo: need to also specify in the route whether it is discovery or vulnerability
  { type: 'vulnerability', route: ROUTES.SCANS, time:"11/09/26 11:32" },
]

const barChartDataDevices: BarDataItem[] = [ 
  { label: 'TOTAL', value: 324 },
  { label: 'OPEN', value: 227 },
  { label: 'COMPROMISED', value: 78 },
];

const barChartDataServices: BarDataItem[] = [ 
  { label: 'TOTAL', value: 684 },
  { label: 'OPEN', value: 327 },
  { label: 'COMPROMISED', value: 128 },
];

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

  const body: unknown = await response.json();
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
    throw new Error('The timeline API returned an invalid response');
  }

  return body as NetworkData;
}

function Home() {
  const [timelineData, setTimelineData] = useState<NetworkData | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [timelineError, setTimelineError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    getTimeline(controller.signal)
      .then(setTimelineData)
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        setTimelineError(error instanceof Error ? error.message : 'Could not load timeline');
      })
      .finally(() => setTimelineLoading(false));

    return () => controller.abort();
  }, []);

  // Calculate severity rank
  var SeverityRank: Severity = 'none';
  if (vulnerabilityScore >= 9.0) SeverityRank = 'critical';
  else if (vulnerabilityScore >= 7.0) SeverityRank = 'high';
  else if (vulnerabilityScore >= 4.0) SeverityRank = 'medium';
  else if (vulnerabilityScore > 0) SeverityRank = 'low';

  // Simulated App Start Date
  const [activeSince, _] = useState<string>('2026-09-20T11:32:00Z');
  const uptimeDisplay = useUptime(activeSince);
  const activeSinceFormated = formatDate(activeSince)

  return (
    <div className='dashboard-shell'>
      <div className='dashboard'>
          {/* Row 1 */}
          <div className='widget widget--vuln-score'>
            <DonutChart score={vulnerabilityScore} maxScore={10} rank={SeverityRank}/>
          </div>

          <div className='widget widget--vuln-stats'>
            <div className='vuln-stats__list'>
              <div className='vuln-stats__item vuln-stats__item--header'>
                <p className='vuln-stats__item__score'>{vulnerabilityTotal}</p>
                <p className='vuln-stats__item__label'>Total vulnerabilities</p>
              </div>
              {vulnerabilityStats.map((item) => {
                  return(
                    <div key={item.severity} className={`vuln-stats__item vuln-stats__item--${item.severity}`}>
                      <p className='vuln-stats__item__score'>{item.count}</p>
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
                  <p className='uptime-scans__uptime__countdown'>{uptimeDisplay}</p>
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
            <BarChart title='Devices' data={barChartDataDevices}/>
          </div>
          <div className='widget widget--services-chart'>
            <BarChart title='Services' data={barChartDataServices}/>
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