import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Icon, type IconName } from '../Icon/Icon';
import { ROUTES } from '../../constants';
import { formatDate } from '../../uptime';
// import { FONTS } from '../../constants';
import './SideNav.css';

type NavItem =
  | { id: 'home';            label: 'HOME';     route: string; icon: IconName }
  | { id: 'devices';         label: 'DEVICES';  route: string; icon: IconName; badge: 'total_devices' }
  | { id: 'services';        label: 'SERVICES'; route: string; icon: IconName; badge: 'total_services' }
  | { id: 'vulnerabilities'; label: 'ISSUES';   route: string; icon: IconName; badge: 'total_vulnerabilities' }
  | { id: 'scans';           label: 'SCANS';    route: string; icon: IconName; meta: true };

const NAV_ITEMS: NavItem[] = [
  { id: 'home',            label: 'HOME',     route: ROUTES.HOME,            icon: 'home' },
  { id: 'devices',         label: 'DEVICES',  route: ROUTES.DEVICES,         icon: 'computer',          badge: 'total_devices' },
  { id: 'services',        label: 'SERVICES', route: ROUTES.SERVICES,        icon: 'linked_services',   badge: 'total_services' },
  { id: 'vulnerabilities', label: 'ISSUES',   route: ROUTES.VULNERABILITIES, icon: 'frame_exclamation', badge: 'total_vulnerabilities' },
  { id: 'scans',           label: 'SCANS',    route: ROUTES.SCANS,           icon: 'mystery',           meta: true },
];

type SystemStatus = {
  total_devices: number;
  total_services: number;
  total_vulnerabilities: number;
  discovery_next_run: string;
  vuln_next_run: string;
};

function isSystemStatus(value: unknown): value is SystemStatus {
  if (typeof value !== 'object' || value === null) return false;

  return (
    'total_devices' in value &&
    typeof value.total_devices === 'number' &&
    Number.isFinite(value.total_devices) &&
    value.total_devices >= 0 &&
    'total_services' in value &&
    typeof value.total_services === 'number' &&
    Number.isFinite(value.total_services) &&
    value.total_services >= 0 &&
    'total_vulnerabilities' in value &&
    typeof value.total_vulnerabilities === 'number' &&
    Number.isFinite(value.total_vulnerabilities) &&
    value.total_vulnerabilities >= 0 &&
    'discovery_next_run' in value &&
    typeof value.discovery_next_run === 'string' &&
    Number.isFinite(Date.parse(value.discovery_next_run)) &&
    'vuln_next_run' in value &&
    typeof value.vuln_next_run === 'string' &&
    Number.isFinite(Date.parse(value.vuln_next_run))
  );
}

function SideNav() {
  const [collapsed, setCollapsed] = useState(false);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const refreshStatus = async () => {
      try {
        const response = await fetch('/api/status', {
          method: 'GET',
          signal: controller.signal,
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
        });

        if (!response.ok) {
          throw new Error(`Could not load system status (HTTP ${response.status})`);
        }

        const body: unknown = await response.json();
        if (!isSystemStatus(body)) {
          throw new Error('The system status API returned an invalid response');
        }

        setStatus(body);
        setStatusError(null);
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') return;
        setStatusError(error instanceof Error ? error.message : 'Could not load system status');
      }
    };

    void refreshStatus();
    const intervalId = window.setInterval(() => void refreshStatus(), 30_000);

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <nav className={`sidenav ${collapsed ? 'sidenav--collapsed' : 'sidenav--expanded'}`}>

      <div className="sidenav__top">
        {/* Collapse toggle */}
        <div className="sidenav__toggle-row" aria-label="shrink navigation button">
          <button
            className={`sidenav__toggle ${collapsed ? 'sidenav__toggle--collapsed' : ''}`}
            onClick={() => setCollapsed(c => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
            <Icon name="arrow_back_ios_new" className='sidenav__icon'/>
          </button>
        </div>

        {/* Nav items */}
        <div className="sidenav__list">
          {NAV_ITEMS.map((item, index) => {
            return (
              <NavLink
                key={item.id}
                to={item.route}
                className={({ isActive }) => [
                  'sidenav__item',
                  isActive ? 'sidenav__item--active' : '',
                  !isActive && index % 2 === 0 ? 'sidenav__item--dark' : '',
                ].join(' ')}
                aria-label={item.label + " button"}
              >
                
                <div className="sidenav__item-left">
                  {/* Icon */}
                  <Icon name={item.icon} className='sidenav__icon'/>

                  {/* Label */}
                  {!collapsed && (
                    <span className="sidenav__label">
                      {item.label}
                    </span>
                  )}
                </div>

                {/* Badge and meta (extra button display data)*/}
                {!collapsed && (
                  <>
                    {'badge' in item && (
                      <span className="sidenav__badge" >
                        {status ? status[item.badge].toLocaleString() : '—'}
                      </span>
                    )}
                    {'meta' in item && status && (
                      <div className="sidenav__meta">
                        <span className="sidenav__meta-text" >
                          D: {formatDate(status.discovery_next_run)}
                        </span>
                        <span className="sidenav__meta-text" >
                          V: {formatDate(status.vuln_next_run)}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
        {!collapsed && statusError && (
          <p className="sidenav__error" role="alert">{statusError}</p>
        )}
      </div>

      {/* Placeholder logo */}
      <div className="sidenav__logo" aria-label={"CERBERUS logo"}>
        <div className="sidenav__logo-mark">
          <div className="sidenav__logo-mark-a" />
          <div className="sidenav__logo-mark-b" />
          <div className="sidenav__logo-mark-c" />
        </div>
        {!collapsed && (
          <span className="sidenav__logo-name">
            CERBERUS
          </span>
        )}
      </div>
    </nav>
  );
}

export default SideNav