import React, { useEffect, useState } from 'react';
import './Settings.css';
import { Icon } from '../Icon/Icon';
import {
  fetchSettings,
  saveSettings,
  setupNmapPrivileges,
  type AppSettingsDTO,
  type NetworkInterfaceDTO,
  type CapabilitiesDTO,
} from '../../api/settings';

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [elevating, setElevating] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [settings, setSettings] = useState<AppSettingsDTO>({
    network_mode: 'auto',
    selected_interface: '',
    custom_network_cidr: '',
    effective_cidr: '',
    effective_exclude_ip: '',
    scan_ports: '',
    discovery_interval_sec: 300,
    vuln_interval_sec: 1800,
    unprivileged_mode: false,
    nmap_path: '',
  });

  const [interfaces, setInterfaces] = useState<NetworkInterfaceDTO[]>([]);
  const [capabilities, setCapabilities] = useState<CapabilitiesDTO | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetchSettings();
      setSettings(res.settings);
      setInterfaces(res.interfaces);
      setCapabilities(res.capabilities);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Could not load configuration',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setFeedback(null);
      const res = await saveSettings(settings);
      setSettings(res.settings);
      setInterfaces(res.interfaces);
      setCapabilities(res.capabilities);
      setFeedback({ type: 'success', message: 'Settings saved and engine hot-reloaded successfully!' });
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to save settings',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleElevatePrivileges = async () => {
    try {
      setElevating(true);
      setFeedback(null);
      const caps = await setupNmapPrivileges();
      setCapabilities(caps);
      setSettings((prev) => ({
        ...prev,
        unprivileged_mode: caps.effective_mode !== 'privileged',
        nmap_path: caps.nmap_path || prev.nmap_path,
      }));
      setFeedback({
        type: 'success',
        message: 'Privilege configuration updated! Live mode: ' + caps.effective_mode.toUpperCase(),
      });
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Privilege elevation cancelled or failed',
      });
    } finally {
      setElevating(false);
    }
  };

  if (loading) {
    return (
      <div className="settings-container">
        <div className="settings-title">
          <Icon name="progress_activity" className="spin" /> LOADING CONFIGURATION...
        </div>
      </div>
    );
  }

  return (
    <div className="settings-container">
      <form onSubmit={handleSave}>
        <div className="settings-header">
          <div className="settings-title">
            <Icon name="settings" /> SYSTEM & NETWORK CONFIGURATION
          </div>
          <div className="settings-header-actions">
            <button
              type="button"
              className="btn btn--dark"
              onClick={loadData}
              disabled={saving || elevating}
            >
              <Icon name="refresh" /> REFRESH
            </button>
            <button
              type="submit"
              className="btn btn--accent"
              disabled={saving || elevating}
            >
              <Icon name={saving ? 'progress_activity' : 'add'} />
              {saving ? 'SAVING...' : 'SAVE CHANGES'}
            </button>
          </div>
        </div>

        {feedback && (
          <div className={`settings-feedback settings-feedback--${feedback.type}`}>
            <Icon name={feedback.type === 'success' ? 'refresh' : 'report'} />
            {feedback.message}
          </div>
        )}

        <div className="settings-grid">
          {/* 1. Target Network Card */}
          <div className="settings-card">
            <div className="settings-card-title">
              <Icon name="radar" /> Target Network Subnet
            </div>

            <div className="settings-field">
              <span className="settings-label">Subnet Selection Mode</span>
              <div className="settings-radio-group">
                <div
                  className={`settings-radio-pill ${settings.network_mode === 'auto' ? 'active' : ''}`}
                  onClick={() => setSettings({ ...settings, network_mode: 'auto' })}
                >
                  AUTOMATIC (CONNECTED NETWORK)
                </div>
                <div
                  className={`settings-radio-pill ${settings.network_mode === 'interface' ? 'active' : ''}`}
                  onClick={() => setSettings({ ...settings, network_mode: 'interface' })}
                >
                  SPECIFIC INTERFACE
                </div>
                <div
                  className={`settings-radio-pill ${settings.network_mode === 'custom' ? 'active' : ''}`}
                  onClick={() => setSettings({ ...settings, network_mode: 'custom' })}
                >
                  CUSTOM CIDR
                </div>
              </div>
            </div>

            {settings.network_mode === 'interface' && (
              <div className="settings-field">
                <span className="settings-label">Select Active Interface</span>
                <select
                  className="settings-select"
                  value={settings.selected_interface}
                  onChange={(e) => setSettings({ ...settings, selected_interface: e.target.value })}
                >
                  <option value="">-- Choose Interface --</option>
                  {interfaces.map((iface) => (
                    <option key={iface.name} value={iface.name}>
                      {iface.name} ({iface.ipv4} → {iface.cidr}) {iface.is_default ? '[DEFAULT]' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {settings.network_mode === 'custom' && (
              <div className="settings-field">
                <span className="settings-label">Manual Subnet CIDR</span>
                <input
                  type="text"
                  className="settings-input"
                  placeholder="e.g. 192.168.1.0/24"
                  value={settings.custom_network_cidr}
                  onChange={(e) => setSettings({ ...settings, custom_network_cidr: e.target.value })}
                />
              </div>
            )}

            <div className="settings-status-box">
              <div className="settings-status-row">
                <span className="settings-status-key">Active Target Subnet:</span>
                <strong className="settings-status-val">{settings.effective_cidr || 'Pending scan'}</strong>
              </div>
              <div className="settings-status-row">
                <span className="settings-status-key">Self Host Exclude IP:</span>
                <strong className="settings-status-val">{settings.effective_exclude_ip || 'None'}</strong>
              </div>
            </div>
          </div>

          {/* 2. Port Scope & Execution Mode Card */}
          <div className="settings-card">
            <div className="settings-card-title">
              <Icon name="linked_services" /> Scanner & Port Profile
            </div>

            <div className="settings-field">
              <span className="settings-label">Port Scope Preset</span>
              <div className="settings-radio-group">
                <div
                  className={`settings-radio-pill ${settings.scan_ports === '' ? 'active' : ''}`}
                  onClick={() => setSettings({ ...settings, scan_ports: '' })}
                >
                  TOP 1,000 PORTS
                </div>
                <div
                  className={`settings-radio-pill ${settings.scan_ports === '1-65535' ? 'active' : ''}`}
                  onClick={() => setSettings({ ...settings, scan_ports: '1-65535' })}
                >
                  ALL 65,535 PORTS
                </div>
                <div
                  className={`settings-radio-pill ${settings.scan_ports !== '' && settings.scan_ports !== '1-65535' ? 'active' : ''}`}
                  onClick={() => {
                    if (settings.scan_ports === '' || settings.scan_ports === '1-65535') {
                      setSettings({ ...settings, scan_ports: '1-10000' });
                    }
                  }}
                >
                  CUSTOM SPECIFICATION
                </div>
              </div>
            </div>

            {settings.scan_ports !== '' && settings.scan_ports !== '1-65535' && (
              <div className="settings-field">
                <span className="settings-label">Custom Port Specification</span>
                <input
                  type="text"
                  className="settings-input"
                  placeholder="e.g. 1-1024,3000,6379,8080"
                  value={settings.scan_ports}
                  onChange={(e) => setSettings({ ...settings, scan_ports: e.target.value })}
                />
              </div>
            )}

            <div className="settings-field">
              <span className="settings-label">Scan Socket Privilege Mode</span>
              <div className="settings-radio-group">
                <div
                  className={`settings-radio-pill ${!settings.unprivileged_mode ? 'active' : ''}`}
                  onClick={() => setSettings({ ...settings, unprivileged_mode: false })}
                >
                  PRIVILEGED (SYN / RAW SOCKET)
                </div>
                <div
                  className={`settings-radio-pill ${settings.unprivileged_mode ? 'active' : ''}`}
                  onClick={() => setSettings({ ...settings, unprivileged_mode: true })}
                >
                  UNPRIVILEGED (TCP CONNECT)
                </div>
              </div>
            </div>
          </div>

          {/* 3. Scan Engine Intervals Card */}
          <div className="settings-card">
            <div className="settings-card-title">
              <Icon name="mystery" /> Scan Schedule Intervals
            </div>

            <div className="settings-field">
              <span className="settings-label">Host Discovery Scan Interval (seconds)</span>
              <input
                type="number"
                min="30"
                className="settings-input"
                value={settings.discovery_interval_sec}
                onChange={(e) => setSettings({ ...settings, discovery_interval_sec: parseInt(e.target.value, 10) || 300 })}
              />
            </div>

            <div className="settings-field">
              <span className="settings-label">Vulnerability Audit Interval (seconds)</span>
              <input
                type="number"
                min="60"
                className="settings-input"
                value={settings.vuln_interval_sec}
                onChange={(e) => setSettings({ ...settings, vuln_interval_sec: parseInt(e.target.value, 10) || 1800 })}
              />
            </div>
          </div>

          {/* 4. Nmap System Privileges Card */}
          <div className="settings-card">
            <div className="settings-card-title">
              <Icon name="bug_report" /> Nmap & OS Elevation
            </div>

            <div className="settings-status-box">
              <div className="settings-status-row">
                <span className="settings-status-key">Binary Location:</span>
                <span className="settings-status-val" style={{ wordBreak: 'break-all' }}>{capabilities?.nmap_path || 'Not Found'}</span>
              </div>
              <div className="settings-status-row">
                <span className="settings-status-key">Version:</span>
                <span className="settings-status-val">{capabilities?.nmap_version || 'Unknown'}</span>
              </div>
              <div className="settings-status-row">
                <span className="settings-status-key">Vuln Script (vulners.nse):</span>
                <span style={{ color: capabilities?.vuln_script_ok ? 'var(--risk-low--light)' : 'var(--risk-critical--light)', fontWeight: 600 }}>
                  {capabilities?.vuln_script_ok ? 'READY' : 'MISSING'}
                </span>
              </div>
              <div className="settings-status-row">
                <span className="settings-status-key">Live Engine Mode:</span>
                <span className={`settings-badge settings-badge--${capabilities?.effective_mode || 'unprivileged'}`}>
                  {capabilities?.effective_mode || 'UNPRIVILEGED'}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="btn btn--light"
              style={{ width: '100%', justifyContent: 'center', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.8rem' }}
              onClick={handleElevatePrivileges}
              disabled={elevating || saving}
            >
              <Icon name={elevating ? 'progress_activity' : 'report'} />
              {elevating ? 'REQUESTING OS ELEVATION...' : 'GRANT ROOT / ADMIN PRIVILEGES'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

