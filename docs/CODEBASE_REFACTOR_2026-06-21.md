# Phase 2 Codebase Optimization

## Overview

Reduced ~2000 LOC and ~15 lint errors across backend and frontend by eliminating duplication, consolidating endpoints, fixing auth stubs, and removing dead code. The production compose service was restored to its canonical name (`command-center`) sourcing from the single `frontend/` directory.

## What Changed

### Created
- `watchman/app/routes/telemetry_routes.py` — traffic-history & telemetry-hosts endpoints (extracted from network_routes.py)
- `watchman/app/routes/device_routes.py` — device CRUD, status, nmap scan endpoints (extracted from network_routes.py)
- `watchman/app/routes/terminal_routes.py` — terminal command & SSH WebSocket endpoints (extracted from network_routes.py)
- `watchman/app/routes/network_utils.py` — shared helpers for network routes (load_metrics, load_host_aliases, find_device, etc.)
- `watchman/app/services/catalog_service.py` — catalog JSON CRUD, suggestion scoring, inventory parsing (extracted from playbook_service.py)
- `watchman/app/services/execution_service.py` — podman commands, playbook running, file ops (extracted from playbook_service.py)
- `watchman/app/services/drift_service.py` — drift/baseline parsing (extracted from playbook_service.py)

### Modified
- `watchman/app/main.py` — removed stale `network_routes` import and registration; added `telemetry_routes`, `device_routes`, `terminal_routes`
- `watchman/app/routes/setup_routes.py` — consolidated preview/apply into shared `_run_setup_pipeline()` + `_build_summary()`, ~50 lines removed
- `watchman/app/routes/audit_routes.py` — replaced hardcoded auth stub (`get_current_user` returning `"auditor_steph"`) with real JWT from `app.core.dependencies`; removed dead `UserSession` and `AuditLogResponse` models; added auth to previously-unprotected `POST /audit-logs/log-action`
- `watchman/app/services/playbook_service.py` — reduced from 874 to ~170 lines (now only LLM modification functions)
- `podman-compose.yaml` — renamed `frontend` service back to `command-center` with image `localhost/sentry-pod-command-center`, sourcing build from `frontend/Dockerfile.prod`
- `watchman/scripts/container_manager.py` — removed 2 dead methods (`_sync_frontend_to_command_center`, `_build_command_center_frontend`), removed call to non-existent `_build_command_center_assets()`, fixed status image from `fresh-command-center` → `localhost/sentry-pod-command-center`
- `frontend/src/pages/AiChat.jsx` — extracted 5 constants (GREETING, THINKING, ANONYMOUS_USER, QUICK_PROMPTS, MODEL_ESTIMATES); fixed 3 mutation bugs in SSE handlers (state objects were being mutated in-place); replaced inline if/else with lookup map
- `frontend/src/pages/Dashboard.jsx` — removed dead `logo` import and `showNotifications` state; extracted `FONT_FAMILY` and `SEVERITY_COLORS` constants
- `frontend/src/components/DiffViewer.jsx` — removed unused `compact` prop
- `frontend/src/components/ExportLogsModal.jsx` — removed unused `filterOptions` const and `setActiveFilter`
- `frontend/src/components/NetworkTrafficChart.jsx` — removed unused `err` parameter in catch
- `frontend/src/pages/AuditLogs.jsx` — suppressed unused `loading`/`error` state values (setters still used)
- `frontend/src/pages/PlaybookManagement.jsx` — suppressed unused `loading` state value (setter still used)
- `frontend/src/pages/NetworkDevices.jsx` — removed 5 unused imports/functions (`useRef`, `getNetworkTerminalSocketUrl`, `saveDeviceConfiguration`, `getProgressColor`, `getPrompt`)
- `AGENTS.md` — updated service table, compose command, Phase 1 notes, container_manager usage

### Deleted
- `watchman/app/routes/network_routes.py` — 1073 lines, all routes now served by telemetry_routes/device_routes/terminal_routes

## Architecture

```
# Backend service split

Before:
  network_routes.py (1073 lines) — devices, telemetry, terminal, utils all in one file
  playbook_service.py (874 lines) — catalog, execution, drift, modification all in one file

After:
  routes/
    network_utils.py       — shared helpers
    telemetry_routes.py    — telemetry endpoints
    device_routes.py       — device CRUD/scan endpoints
    terminal_routes.py     — terminal/SSH endpoints
  services/
    catalog_service.py     — catalog CRUD + scoring
    execution_service.py   — podman + playbook execution
    drift_service.py       — drift/baseline parsing
    playbook_service.py    — LLM modification only (was 874→170 lines)

# Compose stack (4 containers)
  vault ─────────────────┐
  watchman ──────────────┤── MongoDB (vault or Atlas)
  syslog-ng ─────────────┤
  command-center ────────┘  (builds from frontend/Dockerfile.prod)
```

## File-by-File Detail

### 1. `watchman/app/routes/network_routes.py` → 4 files
The monolithic `network_routes.py` (1073 lines) was split along API domain lines:
- **telemetry_routes.py**: `GET /traffic-history`, `GET /telemetry-hosts`
- **device_routes.py**: `GET /devices`, `GET /active-devices`, `POST /active-devices/scan`, `GET /device-status`, `POST /device-status/scan`, `POST /devices`
- **terminal_routes.py**: `POST /devices/{id}/configure`, `GET /devices/{id}/configuration`, `POST /devices/{id}/terminal-command`, `WS /devices/{id}/terminal/ws`
- **network_utils.py**: Shared helpers extracted to avoid circular imports between the three route files.

### 2. `watchman/app/services/playbook_service.py` → 4 files
- **catalog_service.py**: Catalog JSON CRUD, suggestion scoring, inventory parsing
- **execution_service.py**: Podman commands, playbook running, playbook file operations
- **drift_service.py**: Drift report parsing, baseline comparison
- **playbook_service.py**: Kept for LLM modification functions (generate, diff, save) — now ~170 lines

### 3. `watchman/app/routes/setup_routes.py`
The duplicate compute pipeline in `POST /setup/preview` and `POST /setup/apply` was extracted into:
```python
async def _run_setup_pipeline(payload):
    current_ini = setup_service.read_current_ini()
    generated_ini = setup_service.render_ini(payload)
    diff_data = setup_service.compute_diff(current_ini, generated_ini)
    warnings = setup_service._check_warnings(payload)
    flush_plan = setup_service.get_flush_plan()
    markdown = setup_service.generate_report_markdown(payload, diff_data, warnings, flush_plan)
    report_path = setup_service.write_report(markdown)
    return generated_ini, diff_data, warnings, flush_plan, markdown, report_path
```
Both endpoints call this and construct their respective response models from the results.

### 4. `watchman/app/routes/audit_routes.py`
Before (stub):
```python
class UserSession(BaseModel):
    username: str
    role: str

async def get_current_user():
    return UserSession(username="auditor_steph", role="Auditor")
```
After:
```python
from app.core.dependencies import get_current_user

def verify_role_clearance(allowed_roles):
    def dependency(current_user: dict = Depends(get_current_user)):
        ...
```

### 5. `frontend/src/pages/AiChat.jsx`
Constants extracted to module scope:
```javascript
const GREETING = "Hello! I'm your AI Network Assistant...";
const THINKING = "Thinking...";
const ANONYMOUS_USER = "Anonymous User";
const MODEL_ESTIMATES = {
  "deepseek-ai/DeepSeek-R1:novita": "30-60 seconds",
  "google/gemma-4-31B-it:novita": "10-20 seconds",
};
```

Mutation bugs fixed in SSE handlers — was mutating state objects in-place:
```javascript
// Before (bug):
lastAIMessage.text = result;

// After:
updated[updated.length - 1] = { ...lastAIMessage, text: result };
```

### 6. `podman-compose.yaml` + `container_manager.py`
The production compose service was renamed from `frontend` back to `command-center`, sourcing from `frontend/Dockerfile.prod`. The `container_manager.py` had 3 stale references to the deleted `command-center/` directory and a call to a non-existent method (`_build_command_center_assets`). All removed — build now delegates entirely to Dockerfile.prod's multi-stage build.

## Data Flow

```
Developer workflow:

  # Dev (hot-reload)
  cd frontend && npm run dev    → Vite on :5173  ──API──→  uvicorn watchman on :8000

  # Production (compose)
  container_manager.py build    → Dockerfile.prod (node build → nginx)  ──API──→  watchman container
  container_manager.py up       → podman-compose starts all 4 services

  Compose stack:
  Browser → command-center:3000 (nginx) → watchman:8000 (FastAPI) → MongoDB (vault:27017 or Atlas)
                                                                   → podman (sentry-ansible for playbooks)
                                                                   → syslog-ng:10514/udp
```

## Usage

### Build production images
```bash
python watchman/scripts/container_manager.py build
# Builds: sentry-ansible, sentry-pod_watchman, sentry-pod_syslog-ng, localhost/sentry-pod-command-center

python watchman/scripts/container_manager.py build command-center
# Builds just the UI container
```

### Start the stack
```bash
python watchman/scripts/container_manager.py up
# vault:27017, watchman:8000, syslog-ng:10514/udp, command-center:3000
```

### Development
```bash
# Backend (hot-reload)
cd watchman && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend (hot-reload)
cd frontend && npm run dev   # :5173
```

## Design Notes

- **Single source of truth for UI**: `frontend/` serves both dev (Vite) and production (Dockerfile.prod → nginx). The old `command-center/` directory was deleted in Phase 1 after confirming all its changes had been cherry-picked into `frontend/`.
- **Why split `network_routes.py` instead of keeping it monolithic**: 1073 lines violated the single-responsibility principle and made parallel development impossible. Each new file maps 1:1 to an API domain visible in the frontend (telemetry, devices, terminal).
- **Why keep `playbook_service.py` alive**: Rather than creating a fourth new module name, the file was reduced to its original responsibility (LLM modification) — minimizing churn for the 3 callers that import from it.
- **Auth stub in `audit_routes.py`**: Was clearly a development artifact left in production code (`# Temporary helper to simulate your active test user profiles`). Replaced with the canonical `get_current_user` from `app.core.dependencies` that validates JWTs via `jose.jwt.decode`.
- **`container_manager.py` had a latent bug**: The `build("all")` method called `self._build_command_center_assets()` which was never defined — it would have crashed at runtime. Removed entirely since Dockerfile.prod handles the build internally.
- **Lint errors remaining**: 3 pre-existing errors in `Profile.jsx` and `ProtectedRoute.jsx` (unused `role`, impure `Date.now()`, unused `e`) were not addressed as they were outside the scope of this session.
