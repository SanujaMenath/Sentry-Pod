# Configuration Drift Alerts — Automation Feature

## Overview
The **Configuration Drift Alerts** stat card (Row 1) and the larger **Configuration Drift** card (Row 4) on the dashboard are backed by an on-demand automation pipeline. Clicking **Refresh** in the stat card re-runs the `NowRunning` snapshot + `configDrift` diff workflow inside the `sentry-ansible` Podman container, parses the results on the host, and feeds them to the in-app **DiffViewer** for a clean, git-style diff preview.

## What Changed

### Created
- `watchman/playbooks/run_drift_analysis.sh` — bash entry point (existed previously; documented here for completeness).
- `watchman/scripts/parse_drift.py` — host-side summary printer (existed previously; documented here for completeness).
- `frontend/src/utils/diffParser.js` — pure-JS unified-diff parser → `DiffLine` / `DiffHunk` / `ParsedDiff` classes with statistics.
- `frontend/src/components/DiffViewer.jsx` — reusable git-style diff component (compact mode for dashboard previews).
- `frontend/src/pages/DriftReports.jsx` — list view, one card per drifted device with a compact diff preview.
- `frontend/src/pages/DriftReportDetail.jsx` — full-page diff view with copy-to-clipboard and back-button.

### Modified
- `watchman/app/services/playbook_service.py` — `parse_config_drift_reports()` now includes a full `diff_content` field alongside legacy `additions` / `removals` arrays.
- `watchman/app/routes/playbook_routes.py` — `GET /playbooks/drift`, `GET /playbooks/drift/{hostname}`, `POST /playbooks/drift/refresh` (with audit log).
- `frontend/src/pages/Dashboard.jsx` — drift count + refresh handler, plus the larger drift card on Row 4 now embeds a compact `DiffViewer` preview.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  Browser                                                             │
│                                                                      │
│   handleRefreshDrift()                  DriftReports / DetailView    │
│       │                                       │                      │
│       ▼                                       ▼                      │
│   POST /playbooks/drift/refresh       GET /playbooks/drift           │
│                                       GET /playbooks/drift/{host}    │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  FastAPI  (watchman/app/routes/playbook_routes.py:130)               │
│                                                                      │
│   refresh_config_drift()                                             │
│       │                                                              │
│       ├─→ playbook_service.run_drift_analysis()                      │
│       │       └─→ podman run … /bin/bash /ansible/run_drift_         │
│       │              analysis.sh                                     │
│       ├─→ regex-parse "Total Devices with Drift: N" from output      │
│       ├─→ playbook_service.parse_config_drift_reports() → reports[]  │
│       └─→ writes audit_logs (action_name = "drift_analysis_refresh") │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  run_drift_analysis.sh                                               │
│                                                                      │
│   Step 1  ansible-playbook NowRunning.yml -i hosts.ini               │
│              └─→ saves current running config to                     │
│                  /ansible/tempRun/TS_<hostname>.txt                  │
│   Step 2  ansible-playbook configDrift.yml -i hosts.ini              │
│              └─→ diffs GS_*.txt vs TS_*.txt, writes                  │
│                  /ansible/configDrift/DRIFT_<hostname>.diff          │
│   Step 3  python3 ../scripts/parse_drift.py                          │
│              └─→ prints the "Total Devices with Drift: N" banner     │
└──────────────────────────────────────────────────────────────────────┘
```

## File-by-File Detail

### 1. `watchman/playbooks/run_drift_analysis.sh`
Three-step pipeline executed inside the container:
```bash
#!/bin/bash
set -e
echo "--- Step 1: Running NowRunning.yml ---"
ansible-playbook NowRunning.yml -i hosts.ini

echo -e "\n--- Step 2: Running configDrift.yml to generate diffs ---"
ansible-playbook configDrift.yml -i hosts.ini

echo -e "\n--- Step 3: Parsing drift reports via Python ---"
python3 ../scripts/parse_drift.py
```

The `../scripts/` path works because the backend mounts both `playbooks/` (→ `/ansible/`) and `scripts/` (→ `/scripts/`), and the bash script's CWD inside the container is `/ansible/`.

### 2. `watchman/playbooks/NowRunning.yml` & `goldenState.yml`
- `NowRunning.yml` captures the current running configuration from each device in the `[allHosts]` group via `cisco.ios.ios_command` and writes the output to `./tempRun/TS_<hostname>.txt`.
- `goldenState.yml` does the same but writes to `./goldenState/GS_<hostname>.txt`. This is the network baseline snapshot used by the **Network Baselines** sister card; it is also the "before" file for drift diffs.

### 3. `watchman/playbooks/configDrift.yml`
```yaml
- name: Find Config drift
  hosts: allHosts
  gather_facts: false
  tasks:
    - name: Check for Config Drift
      ansible.utils.fact_diff:
        before: "{{ lookup('file', './goldenState/GS_' + inventory_hostname + '.txt')
                    | regex_replace('(?m)^ntp clock-period .*\\n', '')
                    | regex_replace('(?m)^! Current configuration : .*\\n', '') }}"
        after:  "{{ lookup('file', './tempRun/TS_' + inventory_hostname + '.txt')
                    | regex_replace('(?m)^ntp clock-period .*\\n', '')
                    | regex_replace('(?m)^! Current configuration : .*\\n', '') }}"
      register: config_drift
      ignore_errors: true

    - name: Save Config Drift Report
      copy:
        content: "{{ config_drift.diff.prepared }}"
        dest: "./configDrift/DRIFT_{{ inventory_hostname }}.diff"
      delegate_to: localhost
```
Key points:
- Strips two always-changing lines (`ntp clock-period` and `Current configuration : N bytes`) so trivial counter drift is not flagged.
- Writes per-host unified diff files into `./configDrift/DRIFT_<hostname>.diff`.
- Uses `ansible.utils.fact_diff` (bundled with Ansible) so no extra collection is required.

### 4. `watchman/scripts/parse_drift.py`
- Walks `../playbooks/configDrift/DRIFT_*.diff` (with `/ansible/configDrift` fallback for the container) and prints a banner:
  ```
  ==============================
    CONFIG DRIFT AUDIT REPORT
  Total Devices with Drift: <N>
  ==============================
  ```
- The FastAPI route regex-parses this banner to extract the count for the API response.

### 5. `watchman/app/services/playbook_service.py`
#### `parse_config_drift_reports()`
Reads every `DRIFT_*.diff` and returns:
```python
{
    "hostname": "<hostname>",
    "path": "watchman/playbooks/configDrift/DRIFT_<hostname>.diff",
    "mtime": <int epoch>,
    "diff_content": "<full raw diff>",   # NEW
    "additions": ["line1", "line2", ...], # legacy
    "removals":  ["line1", "line2", ...], # legacy
    "summary":   { "added": int, "removed": int },
}
```
ANSI color codes are stripped via the module-level `ANSI_ESCAPE` regex. Legacy `additions` / `removals` arrays are kept for backward compatibility with any older consumer.

#### `read_config_drift_file(hostname)`
Returns the raw `DRIFT_<hostname>.diff` contents (ANSI-stripped). Used by the `GET /playbooks/drift/{hostname}` route.

#### `run_drift_analysis()`
Dual-mount Podman invocation (mirrors `run_baseline_refresh`):
```python
cmd = ["podman", "run", "--rm"]
if platform.system() == "Linux":
    cmd.append("--network=host")
cmd.extend([
    "-v", f"{playbooks_abs_path}:{PODMAN_ANSIBLE_DIR}:Z",
    "-v", f"{scripts_abs_path}:/scripts:Z",
    PODMAN_CONTAINER_IMAGE,
    "/bin/bash", f"{PODMAN_ANSIBLE_DIR}/run_drift_analysis.sh",
])
# 300s timeout, 500 on FileNotFoundError, 408 on TimeoutExpired
```

### 6. `watchman/app/routes/playbook_routes.py`
| Method | Path                       | Purpose                                    |
|--------|----------------------------|--------------------------------------------|
| GET    | `/playbooks/drift`         | List all parsed drift reports              |
| GET    | `/playbooks/drift/{host}`  | Raw `DRIFT_<host>.diff` content            |
| POST   | `/playbooks/drift/refresh` | Run analysis + return updated reports      |

`refresh_config_drift`:
```python
returncode, output = playbook_service.run_drift_analysis()
match = re.search(r"Total Devices with Drift:\s*(\d+)", output)
drift_count = int(match.group(1)) if match else 0
reports = playbook_service.parse_config_drift_reports()
# writes audit_logs entry (action_name="drift_analysis_refresh")
return { "status", "drift_count", "output", "reports": [...] }
```

### 7. `frontend/src/utils/diffParser.js`
Pure utility, no React. Exports three classes:
- `DiffLine` — `{ type: 'addition' | 'removal' | 'context', content }`
- `DiffHunk` — collection of `DiffLine`s + header (`@@ ... @@`) + per-hunk stats
- `ParsedDiff` — full file list + hunks + totals

Parses standard unified-diff format (`--- before`, `+++ after`, `@@ ... @@` hunks). Strips ANSI before parsing. Memoized via `useMemo` in the React layer.

### 8. `frontend/src/components/DiffViewer.jsx`
Reusable presentational component:
- **Summary header** — total `+N −M • K changes`.
- **File headers** — `− a/...` and `+ b/...` with visual indicators.
- **Hunk display** — sticky header per hunk with line numbers and per-hunk stats. Additions green, removals red, context neutral. `+` `−` ` ` line prefixes.
- **Compact mode** — `compact={true}` + `maxLines={N}` for dashboard previews (e.g. 8 in `DriftReports` list, 12 in the Row 4 dashboard card).

### 9. `frontend/src/pages/DriftReports.jsx`
Grid of drift reports. Each card shows:
- Device hostname
- Last update timestamp
- Compact `DiffViewer` preview (8 lines)
- Link to the full report

### 10. `frontend/src/pages/DriftReportDetail.jsx`
Full-page diff view with:
- Back button
- Copy-diff button with feedback
- Full `DiffViewer` (no `maxLines`)

### 11. `frontend/src/pages/Dashboard.jsx`
Two drift touch-points:
1. **Row 1 stat card** — `driftReports.length` count, `handleRefreshDrift()` (POST `/playbooks/drift/refresh`, updates `driftReports` from `result.reports`).
2. **Row 4 card** — Latest hostname, latest `mtime`, compact `DiffViewer` (12 lines), link to `/drift-reports`.

## Data Flow (UI ↔ Backend ↔ Container ↔ Disk)

```
Dashboard.jsx
  └─→ handleRefreshDrift()
       └─→ fetch POST /playbooks/drift/refresh
            └─→ FastAPI route
                 ├─→ playbook_service.run_drift_analysis()
                 │     └─→ podman run … run_drift_analysis.sh
                 │          ├─→ NowRunning.yml        → writes /ansible/tempRun/TS_*.txt
                 │          ├─→ configDrift.yml       → writes /ansible/configDrift/DRIFT_*.diff
                 │          └─→ parse_drift.py        → prints "Total Devices with Drift: N"
                 ├─→ regex-extracts drift_count from output
                 ├─→ parse_config_drift_reports()     → reads DRIFT_*.diff off disk
                 └─→ audit_logs (action_name="drift_analysis_refresh")
       └─→ updates driftReports from result.reports
            └─→ re-renders Row 1 stat card (count) + Row 4 card (preview)
```

## Verified Behaviors
- `python3 -m py_compile` on the modified service / route files → clean.
- `bash -n run_drift_analysis.sh` → syntax OK.
- `vite build` → 2496 modules, no errors.
- End-to-end run regenerates `DRIFT_*.diff` files; `mtime` updates on the host's `watchman/playbooks/configDrift/`.
- FastAPI import-time route registration confirms all three drift routes are mounted.

## Usage

### From the UI
1. Open the dashboard.
2. In the **Configuration Drift Alerts** stat card (Row 1, position 3), click **Refresh**.
3. The button shows a spinner and the label flips to **Running Drift Analysis…**.
4. On success the count updates and the Row 4 card refreshes its compact diff preview.
5. Clicking the Row 1 card navigates to `/drift-reports`; clicking a card there opens the full diff.

### From the CLI
```bash
PLAYBOOKS_DIR=$(cd Sentry-Pod/watchman/playbooks && pwd)
SCRIPTS_DIR=$(cd Sentry-Pod/watchman/scripts && pwd)
podman run --rm --network=host \
  -v "$PLAYBOOKS_DIR:/ansible:Z" \
  -v "$SCRIPTS_DIR:/scripts:Z" \
  sentry-ansible \
  /bin/bash /ansible/run_drift_analysis.sh
```

### Via the API
```bash
# List drift reports
curl http://127.0.0.1:8000/playbooks/drift
# → { "status": "success", "count": N, "reports": [...] }

# Raw diff for a single host
curl http://127.0.0.1:8000/playbooks/drift/R1
# → { "status": "success", "hostname": "R1", "content": "..." }

# Trigger refresh
curl -X POST http://127.0.0.1:8000/playbooks/drift/refresh
# → { "status": "success", "drift_count": N, "output": "...", "reports": [...] }
```

## Audit Trail
Each refresh writes an `audit_logs` entry with:
- `action_name`: `"drift_analysis_refresh"`
- `status`: `"success"` / `"failed"`
- `drift_count`: regex-extracted count
- `output`: combined stdout/stderr
- `username`: `"System"`
- `timestamp`: UTC ISO8601

## Design Notes
- **Why regex the bash output for the count?** The container image is minimal and has no `jq`. Parsing the printed banner is cheap and avoids an extra JSON I/O round-trip from the container.
- **Why include both `diff_content` and `additions/removals`?** The legacy arrays preserve backward compatibility for any external consumer; `diff_content` lets the frontend build a proper structured `DiffViewer` with hunks and context lines.
- **Why strip `ntp clock-period` and `Current configuration : N bytes`?** These two lines change on every device reload and would otherwise produce noise diffs that hide real configuration changes.
- **Compact mode**: limits rendered lines via a CSS clamp + early-exit in the parser so dashboard previews stay performant even when the diff is large.
