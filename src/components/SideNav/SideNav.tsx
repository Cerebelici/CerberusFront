import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Icon, type IconName } from '../Icon/Icon';
import { ROUTES } from '../../constants';
import { formatDate } from '../../uptime';
import { useSystemStatus } from '../../state/useSystemStatus';
// import { FONTS } from '../../constants';
import './SideNav.css';

type NavItem =
  | { id: 'home';            label: 'HOME';     route: string; icon: IconName }
  | { id: 'devices';         label: 'DEVICES';  route: string; icon: IconName; badge: 'total_devices' }
  | { id: 'services';        label: 'SERVICES'; route: string; icon: IconName; badge: 'total_services' }
  | { id: 'vulnerabilities'; label: 'ISSUES';   route: string; icon: IconName; badge: 'total_vulnerabilities' }
  | { id: 'scans';           label: 'SCANS';    route: string; icon: IconName; meta: true }
  | { id: 'settings';        label: 'CONFIG';   route: string; icon: IconName }
  | { id: 'debug';           label: 'DEBUG';    route: string; icon: IconName };

const NAV_ITEMS: NavItem[] = [
  { id: 'home',            label: 'HOME',     route: ROUTES.HOME,            icon: 'home' },
  { id: 'devices',         label: 'DEVICES',  route: ROUTES.DEVICES,         icon: 'computer',          badge: 'total_devices' },
  { id: 'services',        label: 'SERVICES', route: ROUTES.SERVICES,        icon: 'linked_services',   badge: 'total_services' },
  { id: 'vulnerabilities', label: 'ISSUES',   route: ROUTES.VULNERABILITIES, icon: 'frame_exclamation', badge: 'total_vulnerabilities' },
  { id: 'scans',           label: 'SCANS',    route: ROUTES.SCANS,           icon: 'mystery',           meta: true },
  { id: 'settings',        label: 'CONFIG',   route: ROUTES.SETTINGS,        icon: 'settings' },
  { id: 'debug',           label: 'DEBUG',    route: ROUTES.LOGS,            icon: 'bug_report' },
];

type BadgeKey = 'total_devices' | 'total_services' | 'total_vulnerabilities';

function nextRunText(nextRun: string | null | undefined, running: boolean): string {
  if (running) return 'RUNNING';
  return nextRun ? formatDate(nextRun) : '—';
}

function SideNav() {
  const [collapsed, setCollapsed] = useState(false);
  // Status is polled once for the whole app by <SystemStatusProvider>.
  const { status, error: statusError } = useSystemStatus();

  const badgeValue = (key: BadgeKey): string =>
    status ? status[key].toLocaleString() : '—';

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
                        {badgeValue(item.badge)}
                      </span>
                    )}
                    {'meta' in item && status && (
                      <div className="sidenav__meta">
                        <span className="sidenav__meta-text" >
                          D: {nextRunText(status.discovery_next_run, status.is_discovery_running)}
                        </span>
                        <span className="sidenav__meta-text" >
                          V: {nextRunText(status.vuln_next_run, status.is_vuln_running)}
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