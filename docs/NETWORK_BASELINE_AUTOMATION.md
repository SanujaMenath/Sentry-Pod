# Network Baseline Graph — Automation Feature

## Overview
The Network Baseline graph card on the dashboard (Row 2) is now backed by an on-demand automation pipeline that mirrors the Config Drift Alerts and Network Baselines stat cards. Clicking **Refresh** in the card header re-runs the SNMP collection + metric parsing workflow inside the `sentry-ansible` Podman container and forces the chart to re-fetch its data.

## What Changed

### Created
- `watchman/playbooks/run_baseline_refresh.sh` — new bash entry point that the backend invokes via Podman.

### Modified
- `watchman/scripts/collect_snmp.py` — `/ansible/` fallback for `HOSTS_FILE` / `OUTPUT_DIR` so it works when `scripts/` is mounted at `/scripts/` inside the container.
- `watchman/scripts/parse_metrics.py` — `/ansible/` fallback for `INPUT_DIR` / `OUTPUT_REPORT`.
- `watchman/app/services/playbook_service.py` — new `run_baseline_refresh()` helper using the dual-mount pattern (playbooks → `/ansible`, scripts → `/scripts`).
- `watchman/app/routes/playbook_routes.py` — new `POST /playbooks/baseline-graph/refresh` endpoint with audit logging.
- `frontend/src/components/NetworkTrafficChart.jsx` — new Refresh button, `onRefresh` / `isRefreshing` / `refreshKey` props, polished header (icon tile, "Live" label, chevron dropdowns, redundant checkbox removed).
- `frontend/src/pages/Dashboard.jsx` — wires the `handleRefreshGraph` handler into the chart component.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  Browser  (frontend/src/pages/Dashboard.jsx)                         │
│                                                                      │
│   handleRefreshGraph()                                               │
│       │                                                              │
│       ▼                                                              │
│   POST http://127.0.0.1:8000/playbooks/baseline-graph/refresh        │
└──────────────────────────────┬───────────────────────────────────────┘
                               │  JSON: { status, host_count, output }
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  FastAPI  (watchman/app/routes/playbook_routes.py:228)               │
│                                                                      │
│   refresh_baseline_graph()                                           │
│       │                                                              │
│       ├─→ playbook_service.run_baseline_refresh()                    │
│       │                                                              │
│       ├─→ reads watchman/playbooks/snmp_output/per_interface_        │
│       │   metrics.json → derives unique host count                   │
│       │                                                              │
│       └─→ writes audit_logs entry (action_name =                     │
│           "baseline_graph_refresh")                                  │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Podman  (sentry-ansible container)                                  │
│                                                                      │
│   podman run --rm --network=host                                     │
│     -v watchman/playbooks:/ansible:Z                                 │
│     -v watchman/scripts:/scripts:Z                                   │
│     sentry-ansible                                                   │
│     /bin/bash /ansible/run_baseline_refresh.sh                       │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  run_baseline_refresh.sh                                             │
│                                                                      │
│   Step 1  python3 /scripts/collect_snmp.py                           │
│              └─→ snmpbulkwalk on each [allHosts] IP                  │
│              └─→ writes *_mac_notifications.json to /ansible/snmp_   │
│                  output/                                             │
│   Step 2  python3 /scripts/parse_metrics.py                          │
│              └─→ consolidates raw files into                         │
│                  /ansible/snmp_output/per_interface_metrics.json     │
│   Step 3  echo "Total Hosts Telemetried: <N>"                        │
└──────────────────────────────────────────────────────────────────────┘
```

## File-by-File Detail

### 1. `watchman/playbooks/run_baseline_refresh.sh` (new)
Mirror of `run_drift_analysis.sh` / `run_baseline_collection.sh`:
- `set -e` (stop on first error)
- `python3 /scripts/collect_snmp.py`
- `python3 /scripts/parse_metrics.py`
- Reads `per_interface_metrics.json` with inline `python3 -c` to count unique hosts (`jq` is not installed in the container image), then prints `Total Hosts Telemetried: N` for parity with the other refresh scripts that surface a `Total ...: N` summary.
- `chmod +x` (bit already set).

### 2. `watchman/scripts/collect_snmp.py` (patch)
The script derives paths from `__file__`:
```python
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
HOSTS_FILE = os.path.join(REPO_ROOT, "playbooks", "hosts.ini")
OUTPUT_DIR = os.path.join(REPO_ROOT, "playbooks", "snmp_output")
```
Inside the container, `scripts/` is mounted at `/scripts/`, so `REPO_ROOT` would resolve to `/` and the paths would point at `/playbooks/...` which does not exist. Added a guarded fallback (mirrors the existing `/ansible/` fallback in `parse_drift.py:5-7`):
```python
if not os.path.exists(HOSTS_FILE) and os.path.exists("/ansible/hosts.ini"):
    HOSTS_FILE = "/ansible/hosts.ini"
    OUTPUT_DIR = "/ansible/snmp_output"
```
The host-side flow is unchanged (the condition is false on the host).

### 3. `watchman/scripts/parse_metrics.py` (patch)
Original:
```python
INPUT_DIR = "watchman/playbooks/snmp_output"
OUTPUT_REPORT = "watchman/playbooks/snmp_output/per_interface_metrics.json"
```
Inside the container at CWD `/scripts/`, those relative paths resolve to `/scripts/watchman/playbooks/snmp_output/` which does not exist. Added the same fallback pattern:
```python
if not os.path.exists(INPUT_DIR) and os.path.exists("/ansible/snmp_output"):
    INPUT_DIR = "/ansible/snmp_output"
    OUTPUT_REPORT = "/ansible/snmp_output/per_interface_metrics.json"
```

### 4. `watchman/app/services/playbook_service.py` (new helper)
`run_baseline_refresh()` placed right after `run_baseline_collection()`. Structurally identical to `run_drift_analysis()` (`playbook_service.py:261-297`):
```python
def run_baseline_refresh() -> Tuple[int, str]:
    system = platform.system()
    playbooks_abs_path = PLAYBOOKS_DIR.resolve()
    scripts_abs_path = (BASE_DIR / "scripts").resolve()

    cmd = ["podman", "run", "--rm"]
    if system == "Linux":
        cmd.append("--network=host")

    cmd.extend([
        "-v", f"{playbooks_abs_path}:{PODMAN_ANSIBLE_DIR}:Z",
        "-v", f"{scripts_abs_path}:/scripts:Z",
        PODMAN_CONTAINER_IMAGE,
        "/bin/bash", f"{PODMAN_ANSIBLE_DIR}/run_baseline_refresh.sh",
    ])
    # 300s timeout, FileNotFoundError → 500, TimeoutExpired → 408
```
Why dual-mount? `collect_snmp.py` and `parse_metrics.py` are in `scripts/`, the bash script lives in `playbooks/` (the canonical Ansible mount at `/ansible/`), and the metrics file is written back to `playbooks/snmp_output/` so the FastAPI route can pick it up on the host.

### 5. `watchman/app/routes/playbook_routes.py` (new route)
```python
@router.post("/baseline-graph/refresh")
async def refresh_baseline_graph():
    returncode, output = playbook_service.run_baseline_refresh()
    # Count unique hosts from per_interface_metrics.json (no jq in image)
    # Audit log entry: action_name="baseline_graph_refresh"
    return { status, host_count, output }
```
Returns `host_count` derived from the JSON, not parsed from the bash output, so the frontend does not need a regex like the drift/baseline stat cards do. Mirrors the structure of `/playbooks/drift/refresh` and `/playbooks/baseline/refresh`.

### 6. `frontend/src/components/NetworkTrafficChart.jsx` (polish)
- Added `onRefresh`, `isRefreshing`, `refreshKey` props.
- The `useEffect` that fetches traffic data now depends on `refreshKey` so that bumping the key (via `Dashboard`) forces a re-fetch.
- New icon-tile header with `Activity` glyph + bordered background, the live pulse dot moved next to a "Live" subtitle label, and a flex-wrap row that pushes the controls to the right (`ml-auto`).
- Dropdown buttons upgraded to `rounded-lg` with a `ChevronDown` that rotates 180° when open, label wrapped in `truncate`.
- Interface dropdown right-anchored so it does not clip on narrow screens.
- Refresh button moved into the right-aligned controls group, padded and bordered to match the dropdowns.
- Removed the redundant `allInterfaces` checkbox (the same state is already set by the "All interfaces" option in the interface dropdown).

### 7. `frontend/src/pages/Dashboard.jsx` (wiring)
- New state: `isRefreshingGraph`, `graphRefreshKey`.
- New handler: `handleRefreshGraph` POSTs to `/playbooks/baseline-graph/refresh` and bumps `graphRefreshKey` on success so the chart re-fetches.
- `<NetworkTrafficChart />` now receives `onRefresh={handleRefreshGraph}`, `isRefreshing={isRefreshingGraph}`, `refreshKey={graphRefreshKey}`.

## Data Flow (UI ↔ Backend ↔ Container ↔ Disk)

```
Dashboard.jsx
  └─→ button onClick
       └─→ fetch POST /playbooks/baseline-graph/refresh
            └─→ FastAPI route
                 └─→ playbook_service.run_baseline_refresh()
                      └─→ podman run … /bin/bash /ansible/run_baseline_refresh.sh
                           ├─→ /scripts/collect_snmp.py        (writes /ansible/snmp_output/*_mac_notifications.json)
                           └─→ /scripts/parse_metrics.py       (writes /ansible/snmp_output/per_interface_metrics.json)
                 └─→ reads /ansible/snmp_output/per_interface_metrics.json → host_count
                 └─→ writes audit log entry
            └─→ returns { status, host_count, output }
       └─→ bumps graphRefreshKey
            └─→ useEffect([…, refreshKey]) in NetworkTrafficChart
                 ├─→ fetchTelemetryHosts()      → GET /api/network/telemetry-hosts
                 └─→ fetchNetworkTrafficFor()   → GET /api/network/traffic-history?device=…&ifIndex=…&allInterfaces=…
```

## Verified Behaviors
- `python3 -m py_compile` on all four modified Python files → clean.
- `bash -n watchman/playbooks/run_baseline_refresh.sh` → syntax OK.
- `vite build` → 2496 modules, no errors.
- End-to-end container run (via the exact `podman run` command built by `run_baseline_refresh`):
  - 16 hosts polled, 354 interface targets modeled.
  - `per_interface_metrics.json` mtime: `May 28 12:34` → `Jun 03 22:14`.
- FastAPI import-time route registration confirms `POST /playbooks/baseline-graph/refresh` is mounted alongside the existing routes.

## Usage

### From the UI
1. Open the dashboard.
2. In the **Network Baseline** graph card (Row 2), click the new **Refresh** button next to the title.
3. The button shows a spinner and the label flips to **Refreshing…** until the container run completes.
4. The chart and device/interface dropdowns re-fetch automatically.

### From the CLI
Direct container invocation (mirrors what the backend builds):
```bash
PLAYBOOKS_DIR=$(cd Sentry-Pod/watchman/playbooks && pwd)
SCRIPTS_DIR=$(cd Sentry-Pod/watchman/scripts && pwd)
podman run --rm --network=host \
  -v "$PLAYBOOKS_DIR:/ansible:Z" \
  -v "$SCRIPTS_DIR:/scripts:Z" \
  sentry-ansible \
  /bin/bash /ansible/run_baseline_refresh.sh
```

### Via the API
```bash
curl -X POST http://127.0.0.1:8000/playbooks/baseline-graph/refresh
# → { "status": "success", "host_count": 16, "output": "…console output…" }
```

## Audit Trail
Each refresh writes an entry into `audit_logs` with:
- `action_name`: `"baseline_graph_refresh"`
- `status`: `"success"` or `"failed"`
- `host_count`: unique hosts derived from `per_interface_metrics.json`
- `output`: combined stdout/stderr of the container run
- `username`: `"System"` (matches the other refresh routes)
- `timestamp`: UTC ISO8601

## Design Notes
- **Consistency with sibling cards**: uses the same dual-mount Podman pattern, 300s timeout, and audit-log shape as `/playbooks/drift/refresh` and `/playbooks/baseline/refresh`.
- **Why no jq in the bash script**: the `sentry-ansible` image is minimal (only installs `python3`, `snmp`, `nmap`, etc.). The host count is therefore computed inline with `python3 -c "import json; …"`, and the route re-reads the JSON to derive `host_count` for the API response — no string parsing of bash output needed.
- **Why `refreshKey` instead of an imperative refetch**: bumps are reactive and integrate cleanly with the existing `useEffect` debounce / 30s live interval. Avoids leaking `fetchTelemetryHosts` out of the component.
- **Polling interval**: the chart still auto-refreshes every 30s via the existing `setInterval`; the new manual Refresh is purely a force-poll, identical in behavior to the other stat cards.
