# Cerberus Front

Web dashboard for the **Cerberus Network Sentinel** ([SIEM_Home](https://github.com/Cerebelici/SIEM_Home)).
React 19 + TypeScript + Vite. In the desktop app every number on screen comes from the
Sentinel daemon through **Wails IPC**; the logical `/api/...` paths below are routed to
bridge methods by `src/api/wailsBridge.ts`. The daemon no longer exposes a REST UI API.

There is no standalone browser backend anymore: use `wails dev` from the repository
root. `npm run dev` alone starts the UI without data unless a Wails runtime is present.

Nothing is hardcoded, except the Timeline widget, which can be switched to mock data
(see [Timeline data source](#timeline-data-source)).

| Page | Route | Data source |
|---|---|---|
| Home dashboard | `/` | `/api/status`, `/api/posture`, `/api/devices`, `/api/services`, `/api/vulnerabilities`, `/api/timeline` |
| Devices | `/devices` | `/api/devices` |
| Services | `/services` | `/api/services` |
| Issues | `/vulnerabilities` | `/api/vulnerabilities` |
| Scans | `/scans` (`?type=discovery\|vulnerability` highlights a card) | `/api/scans`, `/api/status`, `POST /api/scans/{type}/trigger` |

---

## Quick start

**Prerequisites:** Node.js 20.19+ or 22.12+, the Wails CLI, and the platform toolchain.
The daemon runs inside the desktop app.

```bash
# From the repository root
git submodule update --init --recursive
wails dev
```

`npm run dev` / `npm run build` are still useful for frontend-only checks. They cannot
reach the daemon over HTTP because the UI API was removed; use `wails dev` for an
end-to-end session.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with HMR and the `/api` proxy |
| `npm run build` | Type-check (`tsc -b`) and production build to `dist/` |
| `npm run preview` | Serve `dist/` with the same `/api` proxy |
| `npm run lint` | ESLint (typescript-eslint, react-hooks, react-refresh) |

---

## Configuration (`.env`)

All settings are documented in [`.env.example`](.env.example). `.env` is git-ignored. Restart `npm run dev` after editing it.

| Variable | Read by | Default | Purpose |
|---|---|---|---|
| `DEV_SERVER_HOST` | `vite.config.ts` only | `localhost` | Dev server bind address |
| `DEV_SERVER_PORT` | `vite.config.ts` only | `5173` | Dev server port |
| `VITE_API_TIMEOUT_MS` | browser | `10000` | Per-request timeout |
| `VITE_STATUS_POLL_INTERVAL_MS` | browser | `30000` | `/api/status` polling while idle |
| `VITE_SCAN_POLL_INTERVAL_MS` | browser | `3000` | Polling cadence while a scan is running |
| `VITE_SCAN_WATCH_TIMEOUT_MS` | browser | `900000` | How long the UI follows a triggered scan before giving up |
| `VITE_SCAN_HISTORY_LIMIT` | browser | `50` | Rows requested for the scan history table |

`DEV_*` variables have no `VITE_` prefix on purpose, so they never reach the browser. Shell variables override `.env`, e.g.
`DEV_PROXY_TARGET=http://127.0.0.1:8081 DEV_SERVER_PORT=5174 npm run dev`.

---

## Project structure

```
src/
├── config/env.ts              # typed, validated access to import.meta.env (only place env is read)
├── vite-env.d.ts              # ImportMetaEnv typings
├── api/
│   ├── client.ts              # apiRequest(): logical IPC path dispatch, timeout, abort handling
│   ├── endpoints.ts           # logical paths routed to Wails bridge methods
│   ├── wailsBridge.ts         # Wails IPC contract and path-to-method router
│   ├── types.ts               # DTOs mirroring SIEM_Home internal/model/models.go
│   ├── validators.ts          # runtime payload guards
│   ├── inventory.ts           # fetchDevices / fetchServices / fetchVulnerabilities
│   └── system.ts              # fetchSystemStatus / fetchPosture
├── hooks/useApiResource.ts    # load + abort + refresh-on-key pattern used by every page
├── state/                     # SystemStatusProvider: one shared /api/status poller
├── constants.ts               # routes, severity thresholds/labels, table storage keys
└── components/
    ├── scan/                  # everything scan-related (see below)
    ├── Home/ SideNav/ Devices/ Services/ Vulnerabilities/ VulnerabilityPanel/
    ├── TableData/ TableFilter/ BarChart/ DonutChart/ RiskScore/ StatusIndicator/ Icon/
    └── Timeline/              # network timeline widget
```

### Shared status poller

`<SystemStatusProvider>` (mounted in `main.tsx`) is the only component that polls `GetStatus` through IPC. It polls every
`VITE_STATUS_POLL_INTERVAL_MS` when idle and every `VITE_SCAN_POLL_INTERVAL_MS` while a discovery or vulnerability scan is running.
Each time it sees a running scan finish, it increments `scanGeneration`. Pages pass that value to `useApiResource`,
so devices, services, vulnerabilities and the dashboard refetch automatically after a scan.

### Error handling

`apiRequest()` turns every failure into an `ApiError` (`kind`: `http` | `network` | `timeout` | `invalid-response`).
When the backend sends a `{"error": "..."}` body, that message is shown. Aborts caused by unmounting are re-thrown as
`AbortError` and ignored by components. Pages show a loading skeleton, an inline error, or keep the last good data during a refresh.

---

## Scan feature (`src/components/scan/`)

| File | Responsibility |
|---|---|
| `scanTypes.ts` | `ScanLogDTO`, trigger response, `TriggerPhase`, per-type labels and icons |
| `scanApi.ts` | `triggerScan(type)` → `POST /api/scans/{type}/trigger`; `fetchScanHistory(limit)` → `GET /api/scans` |
| `scanWatcher.ts` | Follows a triggered scan through the scan log until it completes or fails |
| `useTriggerScan.ts` | The trigger state machine used by the UI |
| `ScanPage.tsx` | `/scans` route: capability banner, one card per scan type, history table |
| `ScanTypeCard.tsx`, `TriggerScanButton.tsx`, `ScanStatusIndicator.tsx`, `scanIndicatorState.ts` | Presentation |
| `ScanHistoryTable.tsx` | Filterable and sortable scan log (reuses `TableData` / `TableFilter`) |
| `index.ts` | Public exports of the feature |

**Trigger lifecycle**

```
click ─▶ submitting ─┬─ 202 ─▶ queued ─▶ running (scan log row "running") ─┬─▶ completed (summary)
                     │                                                     └─▶ failed (error_message)
                     ├─ 409 ─▶ conflict ("<type> scan already in progress")
                     └─ network / timeout / 5xx ─▶ error (message shown)
```

- The scan id before triggering is used as a baseline, so the UI identifies its own scan in `/api/scans`.
- While the backend reports a scan of that type running, the button is disabled ("Scan in progress…").
- The watch never ends silently. A vulnerability audit with no active devices, and a watch that exceeds
  `VITE_SCAN_WATCH_TIMEOUT_MS`, both end with an explicit message.

Backend contract (`TriggerDiscovery` / `TriggerVulnerabilityScan` IPC methods):

| `status` | Payload | Meaning |
|---|---|---|
| `running` | `{"message", "status", "scan_type"}` | Request handed to the scheduler worker |
| `conflict` | `{"error", "status", "scan_type"}` | A scan of that type is already running or queued |
| `forbidden` | `{"error", "status", "scan_type"}` | Privilege elevation was refused |
| `unavailable` | `{"error", "status", "scan_type"}` | No scheduler available |

`wailsBridge.ts` converts `conflict` into a rejected promise so the UI shows the same
message it used to show for HTTP 409.

---

## Timeline data source

The Timeline widget in `src/components/Home/Home.tsx` reads `GetTimeline` through IPC.
The "ALL" scope starts at the first scan in the returned window, so a new install shows its first
minutes of data at full width instead of as a thin strip at the end of a 24-hour axis.

---

## Verifying the integration

Run `wails dev`, open the dashboard, and check that the status cards load and the Debug
page shows daemon logs. Then open **Scans** and click **Trigger discovery scan**. The button shows *Submitting…*, then a green
`Scan #N completed …` summary appears and the history table gains a row.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Side nav shows "Could not reach the Cerberus API…" | The app is not running inside Wails IPC (`wails dev`), or the daemon failed to start |
| Daemon fails during startup | Check the Debug page log and the platform prerequisites in the root README |
| `dyld: Library not loaded: …libsimdjson…` when running `npm` on macOS | Broken Homebrew Node. Run `brew reinstall node@22` (or `brew install node && brew link --overwrite node`) |
| Port 5173 busy | Change `DEV_SERVER_PORT` in `.env` |
| Scans finish with 0 vulnerabilities | The backend's nmap `vulners` script needs internet access to vulners.com; check the Scans page capability banner |
