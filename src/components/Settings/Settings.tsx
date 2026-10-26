import React, { useCallback, useEffect, useRef, useState } from 'react';
import './Settings.css';
import { Icon } from '../Icon/Icon';
import { ConfirmModal } from '../ConfirmModal/ConfirmModal';
import { clearAllDevices, clearScanHistory } from '../../api/inventory';
import { errorMessage, isAbortError } from '../../api/client';
import { isWailsApp } from '../../api/wailsBridge';
import { useSystemStatus } from '../../state/useSystemStatus';
import {
  fetchSettings,
  saveSettings,
  setupNmapPrivileges,
  type AppSettingsDTO,
  type NetworkInterfaceDTO,
  type CapabilitiesDTO,
  type SettingsResponseDTO,
} from '../../api/settings';

const MIN_DISCOVERY_INTERVAL_SEC = 30;
const MIN_VULN_INTERVAL_SEC = 60;

function parseInterval(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [elevating, setElevating] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [isResetDevicesModalOpen, setIsResetDevicesModalOpen] = useState(false);
  const [isClearScansModalOpen, setIsClearScansModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  // Side nav badges and scan times come from the shared status poller.
  const { refresh: refreshStatus } = useSystemStatus();

  // Actions at the bottom of the page report at the top; bring the message into view.
  useEffect(() => {
    if (feedback) feedbackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [feedback]);

  // Every value comes from the backend; nothing is shown until it answers.
  const [settings, setSettings] = useState<AppSettingsDTO | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [interfaces, setInterfaces] = useState<NetworkInterfaceDTO[]>([]);
  const [capabilities, setCapabilities] = useState<CapabilitiesDTO | null>(null);

  const applyResponse = useCallback((res: SettingsResponseDTO) => {
    setSettings(res.settings);
    setInterfaces(res.interfaces ?? []);
    setCapabilities(res.capabilities);
    setLoadError(null);
  }, []);

  const loadData = useCallback((signal?: AbortSignal) => {
    fetchSettings(signal)
      .then(applyResponse)
      .catch((err: unknown) => {
        if (!isAbortError(err)) setLoadError(errorMessage(err, 'Could not load configuration'));
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false);
      });
  }, [applyResponse]);

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, [loadData]);

  const handleRefresh = () => {
    setLoading(true);
    setFeedback(null);
    loadData();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    if (settings.discovery_interval_sec < MIN_DISCOVERY_INTERVAL_SEC || settings.vuln_interval_sec < MIN_VULN_INTERVAL_SEC) {
      setFeedback({
        type: 'error',
        message: `Discovery interval must be at least ${MIN_DISCOVERY_INTERVAL_SEC} s and vulnerability interval at least ${MIN_VULN_INTERVAL_SEC} s.`,
      });
      return;
    }
    try {
      setSaving(true);
      setFeedback(null);
      applyResponse(await saveSettings(settings));
      refreshStatus();
      setFeedback({ type: 'success', message: 'Settings saved. A discovery scan of the target network has started.' });
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
      refreshStatus();
      setSettings((prev) => prev && ({
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

  const handleResetDevices = async () => {
    try {
      setMaintenanceLoading(true);
      setFeedback(null);
      const res = await clearAllDevices();
      setIsResetDevicesModalOpen(false);
      refreshStatus();
      setFeedback({
        type: 'success',
        message: `Network inventory reset successfully! Deleted ${res.deleted} tracked devices. Ready for clean discovery scan.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to reset network inventory',
      });
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const handleClearScans = async () => {
    try {
      setMaintenanceLoading(true);
      setFeedback(null);
      const res = await clearScanHistory();
      setIsClearScansModalOpen(false);
      refreshStatus();
      setFeedback({
        type: 'success',
        message: `Cleared ${res.deleted} scan execution logs.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to clear scan history',
      });
    } finally {
      setMaintenanceLoading(false);
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

  if (!settings) {
    return (
      <div className="settings-container">
        <div className="settings-header">
          <div className="settings-title">
            <Icon name="settings" /> SYSTEM & NETWORK CONFIGURATION
          </div>
          <div className="settings-header-actions">
            <button type="button" className="btn btn--dark" onClick={handleRefresh}>
              <Icon name="refresh" />
              <span>RETRY</span>
            </button>
          </div>
        </div>
        <div className="settings-feedback settings-feedback--error" role="alert">
          <Icon name="report" />
          {loadError ?? 'Could not load configuration'}
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
              onClick={handleRefresh}
              disabled={saving || elevating}
            >
              <Icon name="refresh" />
              <span>REFRESH</span>
            </button>
            <button
              type="submit"
              className="btn btn--accent"
              disabled={saving || elevating}
            >
              <Icon name={saving ? 'progress_activity' : 'add'} />
              <span>{saving ? 'SAVING...' : 'SAVE CHANGES'}</span>
            </button>
          </div>
        </div>

        {feedback && (
          <div ref={feedbackRef} className={`settings-feedback settings-feedback--${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>
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
                min={MIN_DISCOVERY_INTERVAL_SEC}
                className="settings-input"
                value={settings.discovery_interval_sec || ''}
                onChange={(e) => setSettings({ ...settings, discovery_interval_sec: parseInterval(e.target.value) })}
              />
            </div>

            <div className="settings-field">
              <span className="settings-label">Vulnerability Audit Interval (seconds)</span>
              <input
                type="number"
                min={MIN_VULN_INTERVAL_SEC}
                className="settings-input"
                value={settings.vuln_interval_sec || ''}
                onChange={(e) => setSettings({ ...settings, vuln_interval_sec: parseInterval(e.target.value) })}
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

            {/* The OS elevation dialog only exists in the desktop app. */}
            {isWailsApp() && (
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
            )}
          </div>

          {/* 5. Database & Network Maintenance */}
          <div className="settings-card settings-card--full">
            <div className="settings-card-title">
              <Icon name="delete" /> Database & Maintenance
            </div>

            <p className="settings-card-desc">
              Use these options when you move your machine to a different network (e.g. coffee shop, office, home) or want a fresh start.
            </p>

            <div className="settings-maintenance-list">
              <div className="settings-maintenance-row">
                <div className="settings-maintenance-info">
                  <span className="settings-maintenance-title">Reset Network Inventory</span>
                  <span className="settings-maintenance-sub">Deletes all devices, ports, and vulns. Preserves scan history.</span>
                </div>
                <button
                  type="button"
                  className="btn btn--dark btn--danger-outline"
                  onClick={() => setIsResetDevicesModalOpen(true)}
                  disabled={maintenanceLoading || saving || elevating}
                >
                  <Icon name="delete" />
                  <span>RESET INVENTORY</span>
                </button>
              </div>

              <div className="settings-maintenance-row">
                <div className="settings-maintenance-info">
                  <span className="settings-maintenance-title">Clear Scan Execution Logs</span>
                  <span className="settings-maintenance-sub">Deletes past scan audit records. Preserves devices.</span>
                </div>
                <button
                  type="button"
                  className="btn btn--dark"
                  onClick={() => setIsClearScansModalOpen(true)}
                  disabled={maintenanceLoading || saving || elevating}
                >
                  <Icon name="delete" />
                  <span>CLEAR SCANS</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Reset Devices Confirmation Modal */}
      <ConfirmModal
        isOpen={isResetDevicesModalOpen}
        title="Reset Network Inventory?"
        message="Are you sure you want to permanently delete all tracked devices, open services, and vulnerability findings?"
        subMessage="Use this when moving to a new network to start a fresh scan. Past scan logs and application configuration settings will remain intact."
        confirmLabel="Reset Inventory"
        loading={maintenanceLoading}
        onConfirm={handleResetDevices}
        onCancel={() => !maintenanceLoading && setIsResetDevicesModalOpen(false)}
      />

      {/* Clear Scans Confirmation Modal */}
      <ConfirmModal
        isOpen={isClearScansModalOpen}
        title="Clear Scan Execution History?"
        message="Are you sure you want to permanently delete all historical scan execution records?"
        subMessage="Discovered devices, open services, and vulnerability findings will remain untouched."
        confirmLabel="Clear Scan History"
        loading={maintenanceLoading}
        onConfirm={handleClearScans}
        onCancel={() => !maintenanceLoading && setIsClearScansModalOpen(false)}
      />
    </div>
  );
}

