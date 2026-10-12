import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Icon, type IconName } from '../Icon/Icon';
import { ROUTES } from '../../constants';
// import { FONTS } from '../../constants';
import './SideNav.css';

type NavItem =
  | { id: 'home';            label: 'HOME';     route: string; icon: IconName; badge: null;   meta: null }
  | { id: 'devices';         label: 'DEVICES';  route: string; icon: IconName; badge: number; meta: null }
  | { id: 'services';        label: 'SERVICES'; route: string; icon: IconName; badge: number; meta: null }
  | { id: 'vulnerabilities'; label: 'ISSUES';   route: string; icon: IconName; badge: number; meta: null }
  | { id: 'scans';           label: 'SCANS';    route: string; icon: IconName; badge: null;   meta: { discovered: string; verified: string } };

const NAV_ITEMS: NavItem[] = [
  { id: 'home',            label: 'HOME',     route: ROUTES.HOME,            icon: 'home',              badge: null, meta: null },
  { id: 'devices',         label: 'DEVICES',  route: ROUTES.DEVICES,         icon: 'computer',          badge: 999,   meta: null },
  { id: 'services',        label: 'SERVICES', route: ROUTES.SERVICES,        icon: 'linked_services',   badge: 999,  meta: null },
  { id: 'vulnerabilities', label: 'ISSUES',   route: ROUTES.VULNERABILITIES, icon: 'frame_exclamation', badge: 999,  meta: null },
  { id: 'scans',           label: 'SCANS',    route: ROUTES.SCANS,           icon: 'mystery',           badge: null, meta: { discovered: '09/09/14 09:14', verified: '09/09/14 09:14' } },
];

function SideNav() {
  // const [active, setActive] = useState<string>('devices');
  const [collapsed, setCollapsed] = useState(false);

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
                    {item.badge !== null && (
                      <span className="sidenav__badge" >
                        {item.badge}
                      </span>
                    )}
                    {item.meta !== null && (
                      <div className="sidenav__meta">
                        <span className="sidenav__meta-text" >
                          D: {item.meta.discovered}
                        </span>
                        <span className="sidenav__meta-text" >
                          V: {item.meta.verified}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
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