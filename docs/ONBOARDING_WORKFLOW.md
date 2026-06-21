# Onboarding Workflow

## Overview

The onboarding wizard guides a first-time user through configuring their own network inventory, credentials, and environment settings — replacing the demo data with their real device topology. It eliminates the need to manually edit `hosts.ini` or understand the Ansible inventory structure. All state is previewed in a generated markdown report before any changes are committed.

## What Changed

### Created
- `watchman/app/models/setup.py` — Pydantic models for the wizard payload (`DeviceEntry`, `GlobalCreds`, `SetupPreviewRequest`, `SetupApplyRequest`, `SetupDiff`, `SetupPreviewResponse`, `SetupApplyResponse`, `SetupStatusResponse`)
- `watchman/app/services/setup_service.py` — Core logic: INI rendering, diff computation, markdown report generation, flush/demo-cleanup, setup status detection, and the three environment init functions (`init_super_admin`, `init_collections_and_indexes`, `generate_jwt_secret`)
- `watchman/app/routes/setup_routes.py` — All `GET /setup/status`, `POST /setup/preview`, `POST /setup/apply`, `POST /setup/init-user`, `POST /setup/init-collections`, `POST /setup/generate-secret`
- `frontend/src/pages/SetupWizard.jsx` — Full-screen 5-step wizard page (outside the sidebar layout)
- `frontend/src/services/setupService.js` — API client functions: `getSetupStatus`, `previewSetup`, `applySetup`, `initUser`, `initCollections`, `generateSecret`

### Modified
- `watchman/app/main.py` — Registered `setup_routes.router`
- `frontend/src/App.jsx` — Added `/setup` route inside `ProtectedRoute` but outside `RootLayout` (no sidebar)
- `frontend/src/pages/Dashboard.jsx` — Checks `/setup/status` on mount; shows amber "Setup Required" banner with CTA when `setup_complete` is false
- `watchman/scripts/smoke_test.py` — Added `--setup` flag that tests status detection and preview generation without side effects; supports `--setup-only` to skip the standard smoke test suite

## Architecture

```
Browser (SetupWizard.jsx)
  └─ POST /setup/preview    ──────┐
  └─ POST /setup/apply    ────────┤
  └─ POST /setup/init-user   ─────┤
  └─ POST /setup/init-collections ┤
  └─ POST /setup/generate-secret  ┤
                                  ▼
                     setup_routes.py
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
          setup_service.py          setup_service.py
          (INI render, diff,        (init_super_admin,
           report, flush,            init_collections,
           detect status)            generate_secret)
                    │                       │
                    ▼                       ▼
           watchman/playbooks/      MongoDB + .env
           hosts.ini, docs/         (users, api_keys,
                                    collections, indexes)
```

## File-by-File Detail

### 1. `watchman/app/models/setup.py`

Defines the contract between the frontend wizard and the backend. Key models:

- `DeviceEntry` — A single network device. Fields: `hostname`, `ip`, optional `vlan_id`, `vlan_name`, `default_gateway`.
- `GlobalCreds` — SSH username, password, enable secret, SNMP community. Defaults to `admin/cisco/public`.
- `SetupPreviewRequest` — The full wizard payload: `global_creds` + arrays of `DeviceEntry` per layer + `hsrp_pairs`.
- `SetupApplyRequest` — Extends `SetupPreviewRequest` with `flush_mongo` and `flush_disk` booleans.
- `SetupDiff` — Structured diff between the current and new inventory: `added`, `removed`, `changed`, `unchanged`.
- `SetupPreviewResponse` — Returns `summary`, `generated_ini`, `diff`, `warnings`, `flush_plan`, `report_path`, and the full `report_markdown`.
- `SetupApplyResponse` — Returns `status`, `message`, `report_path`, `flushed_collections`, `flushed_files`.
- `SetupStatusResponse` — Returns `setup_complete` (bool), `is_demo` (bool), `device_count`, `message`.

### 2. `watchman/app/services/setup_service.py`

The core engine. Key functions:

- `render_ini(payload)` — Walks the payload layer by layer and generates a complete `hosts.ini`. Handles: device deduplication in `[allHosts]`, per-group sections (`Edge_routers`, `Core_Switches`, `Distribution_Switches`, `HSRP_Routers`, `Access_Switches`), per-device vars (vlan_id, vlan_name, defaultGateway), and the `[allHosts:vars]` block with global SSH/SNMP creds. Adds a `# Sentry-Pod managed inventory` header for setup-status detection.
- `_parse_device_lines(ini_text)` — Parses `{hostname: ip}` from an INI string, skipping comment lines and `[vars]` sections. Used by `compute_diff`.
- `compute_diff(current_ini, new_ini)` — Compares two INI strings device-by-device. Returns a dict with `added` (hostname → IP), `removed` (hostname), `changed` (hostname: old → new), and `unchanged` count.
- `_check_warnings(payload)` — Validates the payload for common issues: access switches missing `default_gateway` or `vlan_id`, HSRP with fewer than 2 devices, empty SNMP community.
- `generate_report_markdown(payload, diff, warnings, flush_plan)` — Builds the markdown report with sections: Summary (table), Generated hosts.ini (code block), Changes vs Previous Inventory (added/removed/changed/unchanged), Warnings, Flush Plan, and a footer marking it as preview-only.
- `write_report(markdown)` — Saves the report to `docs/onboarding_report_YYYY-MM-DD.md`.
- `read_current_ini()` / `write_ini(content)` — Read/write `hosts.ini` from disk.
- `flush_mongo_collections()` — Drops all documents from `devices`, `device_configurations`, `cdp_neighbors`, `topology_cache`. Returns count per collection.
- `flush_disk_artifacts()` — Deletes files in `goldenState/`, `configDrift/`, `cdp_output/`, `facts/`, `runningConfigs/`. Returns file counts per directory.
- `get_flush_plan()` — Describes what would be flushed (counts files per dir) without actually flushing. Used by the preview endpoint.
- `detect_setup_status()` — Checks if `hosts.ini` exists and whether it contains demo IP patterns (`192.168.122.x`, `10.0.0.x`). Returns `{setup_complete, is_demo, device_count, message}`.
- `init_super_admin(username, password, email, full_name)` — Creates the first user with `role: "Super Admin"` (bypassing the usual `"pending"` role). Returns `{status: "created"}` or `{status: "skipped"}` if users already exist.
- `init_collections_and_indexes()` — Creates any missing MongoDB collections from the known set (`devices`, `logs`, `device_configurations`, `api_keys`, `playbooks`, `conversations`, `syslog_alerts`, `users`, `audit_logs`, `cdp_neighbors`, `topology_cache`) and creates indexes on `users.username`, `users.email`, `conversations.session_id`, `audit_logs.timestamp`, `audit_logs.username`, `syslog_alerts.timestamp`, `devices.hostname`, `devices.ip`.
- `generate_jwt_secret()` — Generates a 64-char hex string via `secrets.token_hex(32)` and writes/replaces `SECRET_KEY` in the `.env` file.

### 3. `watchman/app/routes/setup_routes.py`

| Endpoint | Auth | Side Effects | Purpose |
|---|---|---|---|
| `GET /setup/status` | None | None | Returns current setup state (public — used by login redirect and dashboard banner) |
| `POST /setup/preview` | None | Saves markdown report to `docs/` | Dry-run: generates INI + report, no persistent changes |
| `POST /setup/apply` | JWT | Writes `hosts.ini`, flushes Mongo + disk | Commits the wizard payload. Supports `?dry_run=true` to validate without writing |
| `POST /setup/init-user` | JWT | Creates user in MongoDB | First Super Admin creation |
| `POST /setup/init-collections` | JWT | Creates collections + indexes | Idempotent database initialization |
| `POST /setup/generate-secret` | JWT | Writes to `.env` file | Random JWT secret generation |

### 4. `frontend/src/pages/SetupWizard.jsx`

A full-screen 5-step wizard (no sidebar, no navbar — rendered outside `RootLayout`):

| Step | Label | Content |
|---|---|---|
| 0 | Environment Setup | 4 independent sections: Create Admin User (form + button), Initialize Database (button + status), HuggingFace API Key (input + test & save), Generate JWT Secret (button + status). Each has its own inline action and status indicator. |
| 1 | Credentials | Global SSH username/password, enable secret, SNMP community. |
| 2 | Core Topology | Three tables (Edge Routers, Core Switches, Distribution Switches) with add/remove rows. HSRP pair checkboxes derived from distribution switches. |
| 3 | Access Layer | Table with hostname, IP, VLAN ID, VLAN Name, Default Gateway. |
| 4 | Review & Apply | Rendered markdown report with Back and Apply buttons. |

Key implementation details:
- Uses `getSetupStatus()` on mount — if already fully configured (not demo), redirects to `/dashboard`.
- The HF API key test uses raw `fetch()` to call the existing `POST /llm/api-key-test` and `POST /llm/api-key` endpoints (not the centralized `api` axios instance, since those endpoints work without auth when testing).
- The `markdownToHtml()` function does a simple regex-based conversion matching the report format from the backend.
- After successful apply, shows a completion screen with a "Go to Dashboard" button.

### 5. `frontend/src/services/setupService.js`

Six functions, all using the centralized `api` axios instance (JWT interceptor included): `getSetupStatus()`, `previewSetup(payload)`, `applySetup(payload)`, `initUser(userData)`, `initCollections()`, `generateSecret()`.

### 6. `frontend/src/pages/Dashboard.jsx`

On mount, calls `getSetupStatus()`. If `setup_complete` is `false`, renders an amber banner at the top of the dashboard with the detection message and a "Set Up Network" button navigating to `/setup`.

### 7. `watchman/scripts/smoke_test.py`

The `--setup` flag runs `test_setup_wizard()`:
1. Checks `/setup/status` against current state
2. Parses the existing `hosts.ini` into a demo payload via `_build_demo_payload()`
3. Posts to `/setup/preview` — asserts 200 and checks that the markdown report contains `## Summary`, `## Generated hosts.ini`, and `## Changes`
4. Cleans up the generated report file

Run with: `python watchman/scripts/smoke_test.py --setup`

## Data Flow

### Wizard preview flow:
```
User fills form → clicks "Preview Configuration"
  → POST /setup/preview (payload JSON)
  → setup_service.render_ini(payload) → returns INI string
  → setup_service.compute_diff(current_ini, new_ini) → returns diff dict
  → setup_service._check_warnings(payload) → returns warnings list
  → setup_service.get_flush_plan() → returns flush plan dict
  → setup_service.generate_report_markdown(...) → returns markdown string
  → setup_service.write_report(markdown) → saves to docs/onboarding_report_*.md
  → Response: {status, summary, generated_ini, diff, warnings, flush_plan, report_path, report_markdown}
  → SetupWizard renders markdown in Step 4
```

### Wizard apply flow:
```
User clicks "Apply Configuration"
  → POST /setup/apply (payload JSON)
  → (same preview pipeline)
  → setup_service.write_ini(generated_ini)
  → setup_service.flush_mongo_collections() (if flush_mongo=true)
  → setup_service.flush_disk_artifacts() (if flush_disk=true)
  → Response: {status: "success", message, report_path, flushed_collections, flushed_files}
  → SetupWizard shows completion screen → "Go to Dashboard"
```

### Setup status detection flow:
```
Dashboard mounts or SetupWizard mounts
  → GET /setup/status (no auth)
  → detect_setup_status():
     - hosts.ini missing? → setup_complete=false, is_demo=false
     - hosts.ini has 192.168.122.* or 10.0.0.* ? → setup_complete=false, is_demo=true
     - otherwise → setup_complete=true, is_demo=false
  → Dashboard shows/hides banner; SetupWizard redirects if already complete
```

### Environment init flows (Step 0):
```
Create Admin User:
  → POST /setup/init-user {username, password, email, full_name}
  → check users collection count
  → if 0: create with role "Super Admin" → {status: "created"}
  → if >0: → {status: "skipped", message}

Initialize Database:
  → POST /setup/init-collections
  → list existing collections, create missing ones
  → list existing indexes, create missing ones
  → {status: "success", collections_created: [...], indexes_created: [...]}

HuggingFace API Key:
  → POST /llm/api-key-test {api_key} → tests with real HF Router call
  → POST /llm/api-key {api_key} → saves to MongoDB + .env
  → {status: "success"} or error

Generate JWT Secret:
  → POST /setup/generate-secret
  → secrets.token_hex(32) → write/replace SECRET_KEY in .env
  → {status: "generated", secret_key: "..."}
```

## Usage

### From the UI

1. Log in (or register as the first user)
2. If `hosts.ini` is missing or contains demo data, an amber banner appears on the dashboard: "Set Up Network"
3. Click the banner — or navigate directly to `/setup`
4. **Step 0 (optional):** Fill in any environment sections you need:
   - Create an admin user (only works for the very first user)
   - Initialize database collections and indexes
   - Test and save a HuggingFace API key
   - Generate a JWT secret
5. Click "Next" to proceed
6. **Step 1:** Enter global SSH credentials and SNMP community
7. **Step 2:** Fill in your Edge Routers, Core Switches, Distribution Switches, and check HSRP pairs
8. **Step 3:** Fill in your Access Switches with VLAN IDs, names, and default gateways
9. Click "Preview Configuration"
10. Review the generated markdown report — it shows the full `hosts.ini`, a diff from the previous inventory, warnings, and the flush plan
11. Click "Apply Configuration" to write the new `hosts.ini` and optionally flush old demo data
12. Click "Go to Dashboard" — the banner is gone and the dashboard reads from your real inventory

### From the CLI

```bash
# Smoke test the wizard (moves hosts.ini, tests endpoints, restores it)
python watchman/scripts/smoke_test.py --setup

# Manual test: back up and remove hosts.ini to trigger setup-needed state
mv watchman/playbooks/hosts.ini /tmp/
# (run the wizard via the UI)
# Restore when done
mv /tmp/hosts.ini watchman/playbooks/hosts.ini
```

### Via the API

```bash
# Check setup status
curl http://localhost:8000/setup/status

# Preview the wizard output (no auth needed)
curl -X POST http://localhost:8000/setup/preview \
  -H "Content-Type: application/json" \
  -d '{
    "global_creds": {"ansible_user": "admin", "ansible_password": "cisco"},
    "edge_routers": [{"hostname": "R1", "ip": "192.168.1.1"}],
    "core_switches": [{"hostname": "CSW1", "ip": "192.168.2.1"}],
    "distribution_switches": [],
    "hsrp_pairs": [],
    "access_switches": []
  }'

# Dry-run apply (validates without side effects, requires JWT)
curl -X POST "http://localhost:8000/setup/apply?dry_run=true" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{...}'

# Apply (writes hosts.ini + flushes, requires JWT)
curl -X POST http://localhost:8000/setup/apply \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{..., "flush_mongo": true, "flush_disk": true}'

# Create first Super Admin
curl -X POST http://localhost:8000/setup/init-user \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"username": "admin", "password": "secret123", "email": "admin@net.local", "full_name": "Admin"}'

# Initialize MongoDB collections and indexes
curl -X POST http://localhost:8000/setup/init-collections \
  -H "Authorization: Bearer <token>"

# Generate new JWT secret
curl -X POST http://localhost:8000/setup/generate-secret \
  -H "Authorization: Bearer <token>"
```

## Design Notes

- **One page, collapsible layers** — The core topology (Step 2) and access layer (Step 3) are separate pages rather than a single scrollable form. This keeps each step focused and avoids overwhelming the user with a wall of inputs. The sections within Step 2 (Edge / Core / Distro) are stacked vertically on one page with add/remove row controls.
- **Optional Step 0** — Environment setup (admin user, DB init, HF key, JWT secret) is intentionally separate from the core network wizard. These are one-time bootstrap actions, not things the user needs to revisit. Each section has its own inline action button and reports its own status independently.
- **`/setup/status` is public** — The status endpoint returns no sensitive data (only device count and a boolean for demo detection). Making it public allows the login page and dashboard to redirect users without requiring a valid session. The `/setup/preview` endpoint is also public for the same reason — it only generates output from user-supplied data. `/setup/apply` requires JWT because it writes to disk and database.
- **Markdown report as the review artifact** — Rather than a complex interactive diff widget, the preview generates a markdown file saved to `docs/`. This gives the network engineer a permanent, human-readable audit of what was applied, viewable in any editor or paste-able into a ticket. The wizard UI renders this same markdown inline using a simple regex-to-HTML converter (no markdown library dependency).
- **Dry-run mode for `?dry_run=true`** — The `/setup/apply` endpoint accepts a query parameter that skips the write and flush steps while running all validation logic. This lets smoke tests and CI pipelines verify the wizard without side effects. The response's `status` field changes to `"dry_run"` and `flushed_collections`/`flushed_files` are returned empty.
- **Demo detection is heuristic** — The `detect_setup_status()` function checks for `192.168.122.x` and `10.0.0.x` IP patterns in `hosts.ini`. If a user's real network happens to use these subnets, the banner will falsely appear. This is an acceptable false-positive: clicking through the wizard with the same values is a no-op, and we add a `# Sentry-Pod managed inventory` header comment after the first apply so future checks can detect the marker comment instead.
- **HSRP as a subset of Distribution Switches** — The `HSRP_Routers` group is built by filtering the `distribution_switches` array by a checkbox selection. Users never enter HSRP-specific devices; they just check which of their distribution switches are HSRP pairs. This avoids duplicating device entries across groups.
- **First-user special case** — The existing auth system creates new users with `role: "pending"`, requiring an existing Super Admin to approve them. This creates a chicken-and-egg problem on first install. The `init_super_admin` function bypasses this by creating the very first user with `role: "Super Admin"` directly. Subsequent calls are no-ops (`status: "skipped"`).
- **`.env` file mutation** — The `generate_jwt_secret` function writes directly to the `.env` file on disk. In containerized deployments, this file is volume-mounted from the host, so the change is visible to the host immediately but the running uvicorn process won't pick up the new `SECRET_KEY` until restart. For fresh deployments this is fine (no existing sessions to invalidate). For running systems, the user should restart watchman after generating a new secret.
