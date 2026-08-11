# Codebase Refactor — Session 2026-06-11

## Overview

Comprehensive cleanup, deduplication, and extraction pass across the Sentry-Pod codebase. The goal was to reduce code duplication, eliminate dead code, extract reusable components, consolidate backend scripts, and add formatter configurations — all without changing any logic, styling, or behavior. The `frontend/` directory received the same treatment as `command-center/` to keep both in sync until a future unification.

## What Changed

### Deleted

- `NetworkDevices.jsx` (repo root) — 114-line legacy prototype component with hardcoded mock data. It used a standalone version of `AddDeviceModal` and `Meter` that were superseded by the page components in `frontend/src/pages/NetworkDevices.jsx` and `command-center/src/pages/NetworkDevices.jsx`. Zero imports from anywhere in the codebase.

- `brain/` — empty placeholder directory containing only `.gitkeep`. No code, no future plans documented.

- `deployments/` — empty placeholder directory containing only `.gitkeep`. No code, no future plans documented.

- `watchman/app/route/` — stale empty directory. Actual routes live in `watchman/app/routes/`. Only contained `__pycache__/`.

- `watchman/app/service/` — stale empty directory. Actual services live in `watchman/app/services/`. Only contained `__pycache__/`.

- `.ansible/collections/`, `.ansible/modules/`, `.ansible/roles/` — empty subdirectories under `.ansible/`. Ansible collections are installed inside the `sentry-ansible` container image, not on the host.

- `watchman/playbooks/run_baseline_collection.sh` — replaced by `run_action.sh collect`.
- `watchman/playbooks/run_baseline_refresh.sh` — replaced by `run_action.sh refresh`.
- `watchman/playbooks/run_drift_analysis.sh` — replaced by `run_action.sh drift`.
- `watchman/scripts/collect_snmp.py` — merged into `collect_and_parse_snmp.py`.
- `watchman/scripts/parse_metrics.py` — merged into `collect_and_parse_snmp.py`.

### Created (command-center and frontend)

**utils/ (shared)**
- `src/utils/playbookOutput.js` — extracted `classifyLine()` function and `mocha` color palette. Used by AiChat.jsx and AuditLogDetailModal.jsx for syntax-coloring Ansible playbook output. Replaces two identical inline copies.

**hooks/ (shared)**
- `src/hooks/useCopyToClipboard.js` — extracted the `copied`/`setCopied` + `setTimeout` + `navigator.clipboard.writeText` pattern. Used by AiChat.jsx (ExpandableOutput), DriftReportDetail.jsx, and AuditLogDetailModal.jsx. Replaces three identical inline implementations.

**components/ (17 new files per frontend)**

| Component | Extracted From | Lines | Key Deps |
|---|---|---|---|
| `ExpandableOutput` | AiChat.jsx | 69 | lucide-react, classifyLine, useCopyToClipboard |
| `PlaybookSuggestions` | AiChat.jsx | 48 | lucide-react |
| `DeviceCard` | NetworkDevices.jsx | ~95 | lucide-react, UsageBar |
| `TerminalDeviceModal` | NetworkDevices.jsx | ~75 | react, networkService, Cursor |
| `EditDeviceModal` | NetworkDevices.jsx | ~90 | react, networkService, ConfigSection, ConfigField |
| `UsageBar` | NetworkDevices.jsx | ~15 | none |
| `Cursor` | NetworkDevices.jsx | ~15 | none |
| `ConfigSection` | NetworkDevices.jsx | ~20 | none |
| `ConfigField` | NetworkDevices.jsx | ~10 | none |
| `PlaybookModal` | PlaybookManagement.jsx | 124 | react, lucide-react |
| `Toggle` | Settings.jsx | 14 | none |
| `SettingRow` | Settings.jsx | 15 | Toggle |
| `SeverityBadge` | StagingGate.jsx | 17 | lucide-react |
| `TopoPanel` | TopologyMap.jsx | 10 | none |
| `LegendDot` | TopologyMap.jsx | 5 | none |
| `LegendIcon` | TopologyMap.jsx | 5 | none |
| `TopoStat` | TopologyMap.jsx | 5 | none |

**Backend only:**
- `watchman/playbooks/run_action.sh` — single parameterized shell script replacing three scripts. Accepts `collect|refresh|drift` as first argument.
- `watchman/scripts/collect_and_parse_snmp.py` — merged `collect_snmp.py` + `parse_metrics.py`. Calls both `collect_snmp()` and `parse_metrics()` sequentially.
- `watchman/pyproject.toml` — ruff configuration (line-length 120, py311 target, flake8-compatible rules).
- `command-center/.prettierrc`, `frontend/.prettierrc` — Prettier configuration (semi, double quotes, trailing commas, 100 print width).

### Modified

- `watchman/app/services/playbook_service.py` — `run_drift_analysis()`, `run_baseline_collection()`, `run_baseline_refresh()` now call `run_action.sh drift`, `run_action.sh collect`, `run_action.sh refresh` respectively instead of three separate scripts.
- `watchman/scripts/run_collect_for_duration.sh` — references `collect_and_parse_snmp.py` instead of `collect_snmp.py` + `parse_metrics.py`.
- `command-center/src/pages/AiChat.jsx` — 703→563 lines. Removed local `mocha`, `classifyLine`, `ExpandableOutput`, `PlaybookSuggestions`. Added 4 imports. Replaced inline `handleCopy` with `useCopyToClipboard()`. Replaced hardcoded `mocha.subtext1` with literal `"#bac2de"`.
- `command-center/src/pages/AuditLogs.jsx` — replaced 4 inline stat card divs with `<StatCard>` component usage. Imported `StatCard` from components.
- `command-center/src/pages/DriftReportDetail.jsx` — 87→80 lines. Replaced inline `copied`/`handleCopy` with `useCopyToClipboard()` hook.
- `command-center/src/pages/NetworkDevices.jsx` — 474→116 lines. Removed 7 local component definitions + 2 helper functions. Added 7 component imports + `normalizeDevice` named import.
- `command-center/src/pages/PlaybookManagement.jsx` — removed local `PlaybookModal`, added import.
- `command-center/src/pages/Settings.jsx` — removed local `Toggle`/`SettingRow`, added imports.
- `command-center/src/pages/StagingGate.jsx` — removed local `SeverityBadge`, added import.
- `command-center/src/pages/TopologyMap.jsx` — removed local `Panel`/`LegendDot`/`LegendIcon`/`Stat`, added imports.
- `command-center/src/components/AuditLogDetailModal.jsx` — 160→117 lines. Removed local `mocha`/`classifyLine`. Added imports for `classifyLine` and `useCopyToClipboard`. Replaced inline copy logic with hook.
- `frontend/src/...` — identical edits applied to all parallel paths.

## Architecture

```
Pre-refactor:
  AiChat.jsx (703 lines)          NetworkDevices.jsx (474 lines)
  ├── mocha palette (inline)      ├── normalizeDevice (inline)
  ├── classifyLine (inline)       ├── getStatusStyles (inline)
  ├── ExpandableOutput (inline)   ├── DeviceCard (inline)
  ├── PlaybookSuggestions (inline)├── TerminalDeviceModal (inline)
  └── handleCopy (inline)         ├── EditDeviceModal (inline)
                                  │   ├── ConfigSection (inline)
  AuditLogs.jsx                   │   └── ConfigField (inline)
  ├── 4 inline stat cards         ├── UsageBar (inline)
  └── handleCopy (inline)         └── Cursor (inline)

  DriftReportDetail.jsx           (3 more pages with inline components)
  └── handleCopy (inline)

  AuditLogDetailModal.jsx
  ├── mocha + classifyLine (inline)
  └── handleCopy (inline)

  3 shell scripts → subprocess    2 Python scripts → always sequential

Post-refactor:
  utils/playbookOutput.js          hooks/useCopyToClipboard.js
  └── classifyLine()               └── { copied, handleCopy }

  components/
  ├── ExpandableOutput.jsx         components/ (cont.)
  ├── PlaybookSuggestions.jsx      ├── PlaybookModal.jsx
  ├── DeviceCard.jsx               ├── Toggle.jsx
  ├── TerminalDeviceModal.jsx     ├── SettingRow.jsx
  ├── EditDeviceModal.jsx         ├── SeverityBadge.jsx
  │   ├── imports ConfigSection   ├── TopoPanel.jsx
  │   └── imports ConfigField     ├── LegendDot.jsx
  ├── UsageBar.jsx                 ├── LegendIcon.jsx
  └── Cursor.jsx                   └── TopoStat.jsx

  playbooks/run_action.sh {collect|refresh|drift}
  scripts/collect_and_parse_snmp.py
```

## Data Flow (Component Extraction Pattern)

```
Before:  ParentPage.jsx
         ├── const SubComponent = (...) => { ... }   ← inline
         └── <SubComponent />                         ← usage in JSX

After:   components/SubComponent.jsx
         └── export default function SubComponent(...) { ... }

         ParentPage.jsx
         ├── import SubComponent from "../components/SubComponent"
         └── <SubComponent />                         ← same usage, unchanged
```

The extracted components receive all data as props from the parent. No component makes its own API calls, manages its own effect state, or imports services. They are pure presentation components. The only exception is `TerminalDeviceModal` which uses `getNetworkTerminalSocketUrl` from networkService (WebSocket URL builder — stateless utility, not a side effect).

## Usage

### From the UI

No visible changes. The UI is identical before and after the refactor. The only structural difference is:
- `/audit-logs` page now uses the same `<StatCard>` component as `/dashboard` and `/playbooks` (visually identical, same CSS).
- Component file count went from 13 to 30 in `components/`.

### From the CLI (new/changed commands)

```bash
# Run a playbook action using the merged script
python watchman/scripts/container_manager.py run collect    # baseline collection
python watchman/scripts/container_manager.py run refresh    # SNMP baseline refresh
python watchman/scripts/container_manager.py run drift      # drift analysis

# Or directly inside the container:
bash /ansible/run_action.sh collect
bash /ansible/run_action.sh refresh
bash /ansible/run_action.sh drift

# Collect + parse SNMP in one step (host-side)
python3 watchman/scripts/collect_and_parse_snmp.py

# Format code (new — requires formatter install)
cd command-center && npx prettier --write src/
cd watchman && ruff format .
```

### Via the API (unchanged)

All API endpoints remain the same. The `playbook_service.py` changes are internal — the podman command now passes `run_action.sh <action>` instead of a dedicated script file:

```bash
# Before:  /bin/bash /ansible/run_drift_analysis.sh
# After:   /bin/bash /ansible/run_action.sh drift
```

The endpoints `/playbooks/drift/refresh`, `/playbooks/baseline/refresh`, `/playbooks/baseline-graph/refresh` continue to work identically.

## Troubleshooting

### "Component not found" import error at build time

If a previously inline component was extracted but a page file still references it as a local definition, you'll see a compile error. This was our most common edit pattern — verify the page file no longer has the `const ComponentName = ...` definition and has the correct `import ComponentName from "../components/ComponentName"`.

### `playbook_service.py` podman command fails

If `run_action.sh` is missing the executable bit or isn't found at the expected path inside the container, the podman run will exit with code 127. Verify:
- The file exists at `watchman/playbooks/run_action.sh`
- Has `chmod +x` (ours does)
- The volume mount in `playbook_service.py` maps `playbooks/` to `/ansible/` inside the container
- The command arguments are correct: `"/bin/bash", f"{PODMAN_ANSIBLE_DIR}/run_action.sh", "drift"` (three separate list elements)

### `collect_and_parse_snmp.py` fails

This merged script runs both `collect_snmp()` and `parse_metrics()` in sequence. If one fails, the other still runs. To debug individually:
- Comment out the function call you don't need in the `if __name__ == "__main__":` block
- Check that `snmpbulkwalk` is installed (requires `net-snmp-utils` or equivalent)
- Verify `HOSTS_FILE` resolution — it falls back to `/ansible/hosts.ini` inside containers

### `frontend/` and `command-center/` drift

Both directories now have identical component structure (30 files each). If you make changes to one, apply them to the other to prevent drift. The only difference between the two is the env config (`.env` files and vite config), and the production Dockerfile in `command-center/`.

## Design Notes

- **Why keep two frontend directories?** `command-center/` is the production target (podman/nginx-served). `frontend/` is for quick host-based dev without containers (`uvicorn + npm run dev`). They will be unified once the project stabilizes, potentially via a symlink or a shared source structure.

- **Why not merge the backend API endpoints?** Playbook execution (blocking POST vs SSE streaming GET), nmap scan endpoints, and device listing endpoints were identified as merge candidates but intentionally deferred. They involve behavioral changes and test validation that fall outside a structural refactor.

- **Why not fix the hardcoded API URLs?** 18 hardcoded `localhost:8000` / `127.0.0.1:8000` references exist across 8 frontend files. They all work correctly because both addresses resolve to the same service. The issue was tagged as clean tech debt — fixing it would provide zero functional benefit until the API base actually needs to change.

- **Component extraction pattern**: Every extracted component is a pure presentation component. It receives data via props and renders it. No extracted component makes API calls, manages effects, or imports services. This keeps them testable and reusable. The single exception is `TerminalDeviceModal`, which imports `getNetworkTerminalSocketUrl` — a stateless utility function that builds a WebSocket URL string, not a service with side effects.

- **Shell script merge**: The three `run_*.sh` scripts shared the same structure (echo steps → run ansible/Python → count results → print summary). They diverged only in which playbook/Python they ran. `run_action.sh` consolidates them with a `case` statement. This also simplifies `playbook_service.py` — three near-identical podman-launch functions now differ only in volume mounts (baseline collection doesn't need `/scripts` mounted; drift and refresh do).

- **Python script merge**: `collect_snmp.py` and `parse_metrics.py` were always called sequentially and shared the same path resolution logic (`os.path.dirname(__file__)` → `playbooks/snmp_output/`). Merging them eliminated the intermediate host-level coupling. The `run_collect_for_duration.sh` loop script was updated to call the merged script once per iteration instead of two scripts.

- **StatCard usage**: AuditLogs.jsx had 4 inline stat cards that were visually identical to the `<StatCard>` component used by Dashboard.jsx and PlaybookManagement.jsx. The inline versions used the same structure (icon + title + value + iconBg + iconColor pattern). Replacing them with `<StatCard>` reduced ~36 lines of duplicated markup to 4 declarative lines. RBACUsers.jsx was left alone — its role cards are a fundamentally different pattern (role name + count badge + description), not an instance of StatCard.

- **No formatter was run**: The `pyproject.toml` and `.prettierrc` configs define the target style but no formatting pass was executed. This avoids introducing whitespace noise into the refactor. Run `ruff format watchman/` and `npx prettier --write command-center/src/ frontend/src/` in a separate commit.
