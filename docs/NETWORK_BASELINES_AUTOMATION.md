# Network Baselines — Automation Feature

## Overview
The **Network Baselines** stat card (Row 1, rightmost) on the dashboard is backed by an on-demand automation pipeline. Clicking **Refresh** re-runs the `goldenState` snapshot inside the `sentry-ansible` Podman container, counts the resulting `GS_*.txt` files, and updates the card. The captured baselines are the "before" reference used by the sister **Configuration Drift** card.

## What Changed

### Created
- `watchman/playbooks/run_baseline_collection.sh` — bash entry point (existed previously; documented here for completeness).
- `watchman/playbooks/goldenState.yml` — Ansible playbook that captures each device's running config (existed previously; documented here for completeness).

### Modified
- `watchman/app/services/playbook_service.py` — `run_baseline_collection()` (single-mount Podman) and `get_baselined_devices()` helper.
- `watchman/app/routes/playbook_routes.py` — `GET /playbooks/baseline` and `POST /playbooks/baseline/refresh` endpoints.
- `frontend/src/pages/Dashboard.jsx` — baseline count + refresh handler.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  Browser  (frontend/src/pages/Dashboard.jsx)                         │
│                                                                      │
│   handleRefreshBaseline()                                            │
│       │                                                              │
│       ▼                                                              │
│   POST http://127.0.0.1:8000/playbooks/baseline/refresh              │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  FastAPI  (watchman/app/routes/playbook_routes.py:185)               │
│                                                                      │
│   refresh_network_baselines()                                        │
│       │                                                              │
│       ├─→ playbook_service.run_baseline_collection()                 │
│       │       └─→ podman run … /bin/bash /ansible/run_baseline_      │
│       │              collection.sh                                   │
│       ├─→ regex-parse "Total Devices Baselined: N" from output       │
│       ├─→ playbook_service.get_baselined_devices() → devices[]       │
│       └─→ writes audit_logs (action_name = "baseline_collection_     │
│              refresh")                                               │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  run_baseline_collection.sh                                          │
│                                                                      │
│   Step 1  ansible-playbook goldenState.yml -i hosts.ini              │
│              └─→ saves 'show run' output per host to                 │
│                  /ansible/goldenState/GS_<hostname>.txt              │
│   Step 2  COUNT=$(ls -1 ./goldenState/GS_*.txt 2>/dev/null | wc -l)  │
│           echo "Total Devices Baselined: $COUNT"                     │
└──────────────────────────────────────────────────────────────────────┘
```

## File-by-File Detail

### 1. `watchman/playbooks/run_baseline_collection.sh`
```bash
#!/bin/bash
set -e

echo "--- Step 1: Running goldenState.yml to save golden state baselines ---"
ansible-playbook goldenState.yml -i hosts.ini

echo -e "\n--- Step 2: Counting baselined devices ---"
COUNT=$(ls -1 ./goldenState/GS_*.txt 2>/dev/null | wc -l)
echo "Total Devices Baselined: $COUNT"

echo -e "\nWorkflow complete."
```
The route regex-parses the `Total Devices Baselined:` line to extract the count for the API response.

### 2. `watchman/playbooks/goldenState.yml`
```yaml
- name: Save the golden state config files
  hosts: allHosts
  gather_facts: false
  tasks:
    - name: Copy config files
      cisco.ios.ios_command:
        commands:
          - command: 'sh run'
      register: golden_state
    - name: Save golden state config files(format inventory_hostname.txt)
      copy:
        content: "{{golden_state.stdout | join ('\n') }}"
        dest: "./goldenState/GS_{{inventory_hostname}}.txt"
```
- Runs `show run` against every host in the `[allHosts]` inventory group.
- Writes the result to `./goldenState/GS_<hostname>.txt` (one file per device).
- These files double as the "before" reference for `configDrift.yml` (the sister drift feature).

### 3. `watchman/app/services/playbook_service.py`
#### `get_baselined_devices()`
```python
def get_baselined_devices() -> List[str]:
    golden_dir = PLAYBOOKS_DIR / "goldenState"
    devices = []
    if golden_dir.exists() and golden_dir.is_dir():
        for path in golden_dir.glob("GS_*.txt"):
            hostname = path.name.replace("GS_", "").replace(".txt", "")
            devices.append(hostname)
    return sorted(devices)
```
Returns a sorted list of hostnames derived from the on-disk `GS_*.txt` files. Used by the `GET /playbooks/baseline` route and as the source of truth for the `POST /playbooks/baseline/refresh` response.

#### `run_baseline_collection()`
Single-mount Podman invocation (playbooks only — no scripts needed):
```python
cmd = ["podman", "run", "--rm"]
if platform.system() == "Linux":
    cmd.append("--network=host")
cmd.extend([
    "-v", f"{playbooks_abs_path}:{PODMAN_ANSIBLE_DIR}:Z",
    PODMAN_CONTAINER_IMAGE,
    "/bin/bash", f"{PODMAN_ANSIBLE_DIR}/run_baseline_collection.sh",
])
# 300s timeout, 500 on FileNotFoundError, 408 on TimeoutExpired
```
Note: unlike `run_drift_analysis` / `run_baseline_refresh`, this helper only mounts `playbooks/`. The golden state capture is a pure-Ansible workflow, so the `scripts/` mount is not required.

### 4. `watchman/app/routes/playbook_routes.py`
| Method | Path                          | Purpose                                       |
|--------|-------------------------------|-----------------------------------------------|
| GET    | `/playbooks/baseline`         | List of baselined hostnames                   |
| POST   | `/playbooks/baseline/refresh` | Capture baselines + return updated device list|

`refresh_network_baselines`:
```python
returncode, output = playbook_service.run_baseline_collection()
match = re.search(r"Total Devices Baselined:\s*(\d+)", output)
baseline_count = int(match.group(1)) if match else 0
devices = playbook_service.get_baselined_devices()
# writes audit_logs (action_name="baseline_collection_refresh")
return { "status", "baseline_count", "devices", "output" }
```

### 5. `frontend/src/pages/Dashboard.jsx`
#### Stat card
```jsx
<div className="bg-[#1D293DED] border border-slate-700/50 rounded-3xl p-6 ...">
  <p className="text-slate-400 text-sm font-medium mb-2">Network Baselines</p>
  <h3 className="text-4xl font-extrabold text-white ...">
    {isRefreshingBaseline ? "..." : String(baselineCount)}
  </h3>
  <p className="text-xs text-slate-500 mt-2 font-medium">
    {baselineCount > 0 ? `${baselineCount} devices baselined` : "No devices baselined"}
  </p>
  <button onClick={handleRefreshBaseline} disabled={isRefreshingBaseline} className="...">
    <RefreshCw size={14} className={isRefreshingBaseline ? 'animate-spin' : ''} />
    {isRefreshingBaseline ? 'Baselining devices...' : 'Refresh'}
  </button>
</div>
```
- Cyan accent (`bg-cyan-600/20 text-cyan-400`) to distinguish it from the amber drift card.
- No `onClick` on the wrapper (this card is not a navigation target).

#### `handleRefreshBaseline()`
```js
const handleRefreshBaseline = async (e) => {
  if (e) e.stopPropagation();
  setIsRefreshingBaseline(true);
  try {
    const res = await fetch('http://127.0.0.1:8000/playbooks/baseline/refresh', { method: 'POST' });
    if (res.ok) {
      const result = await res.json();
      if (result?.devices) setBaselineCount(result.devices.length);
    }
  } catch (err) { console.error('Error triggering baseline collection:', err); }
  finally { setIsRefreshingBaseline(false); }
};
```

## Data Flow (UI ↔ Backend ↔ Container ↔ Disk)

```
Dashboard.jsx
  └─→ handleRefreshBaseline()
       └─→ fetch POST /playbooks/baseline/refresh
            └─→ FastAPI route
                 ├─→ playbook_service.run_baseline_collection()
                 │     └─→ podman run … run_baseline_collection.sh
                 │          ├─→ goldenState.yml        → writes /ansible/goldenState/GS_*.txt
                 │          └─→ ls + wc -l             → prints "Total Devices Baselined: N"
                 ├─→ regex-extracts baseline_count from output
                 ├─→ get_baselined_devices()        → reads GS_*.txt off disk
                 └─→ audit_logs (action_name="baseline_collection_refresh")
       └─→ updates baselineCount from result.devices.length
            └─→ re-renders stat card
```

## Relationship to Sister Features
- The `GS_*.txt` files produced here are the **"before"** state consumed by `configDrift.yml` (the **Configuration Drift** sister card).
- Running the Network Baselines refresh after a known-good configuration change effectively "resets" the drift baseline, so subsequent drift detection only flags new deltas.

## Verified Behaviors
- `python3 -m py_compile` on the modified service / route files → clean.
- `bash -n run_baseline_collection.sh` → syntax OK.
- `vite build` → 2496 modules, no errors.
- End-to-end run regenerates `GS_*.txt` files; `mtime` updates on the host's `watchman/playbooks/goldenState/`.
- FastAPI import-time route registration confirms both baseline routes are mounted.

## Usage

### From the UI
1. Open the dashboard.
2. In the **Network Baselines** stat card (Row 1, rightmost), click **Refresh**.
3. The button shows a spinner and the label flips to **Baselining devices…**.
4. On success the count and the subtext (`N devices baselined`) update.

### From the CLI
```bash
PLAYBOOKS_DIR=$(cd Sentry-Pod/watchman/playbooks && pwd)
podman run --rm --network=host \
  -v "$PLAYBOOKS_DIR:/ansible:Z" \
  sentry-ansible \
  /bin/bash /ansible/run_baseline_collection.sh
```

### Via the API
```bash
# List baselined devices
curl http://127.0.0.1:8000/playbooks/baseline
# → { "status": "success", "count": N, "devices": ["ESW1", "ESW2", ...] }

# Trigger a fresh capture
curl -X POST http://127.0.0.1:8000/playbooks/baseline/refresh
# → { "status": "success", "baseline_count": N, "devices": [...], "output": "..." }
```

## Audit Trail
Each refresh writes an `audit_logs` entry with:
- `action_name`: `"baseline_collection_refresh"`
- `status`: `"success"` / `"failed"`
- `baseline_count`: length of `devices` from the post-run directory scan
- `output`: combined stdout/stderr
- `username`: `"System"`
- `timestamp`: UTC ISO8601

## Design Notes
- **Why single-mount?** Golden state capture is pure Ansible; it does not need any of the host-side Python SNMP utilities, so the second `-v scripts:/scripts:Z` mount is omitted to keep the container footprint small and the SELinux relabeling minimal.
- **Why read the count off disk (`get_baselined_devices`) instead of trusting the bash count?** Both are kept in sync, but the disk read is the source of truth — it reflects whatever state the file system is actually in, even if a previous run was interrupted or partially failed.
- **Why the `e?.stopPropagation()` guard on the click handler?** Defensive — the stat card is currently a non-clickable container, but the guard keeps the handler safe to reuse if the card later becomes a navigation target.
- **Resetting the drift baseline**: running this refresh is the canonical "I just made a known-good change" action; subsequent drift refreshes will not flag those changes because they match the new golden state.
