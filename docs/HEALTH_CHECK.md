# Codebase Health Check & Repair

## Overview

Systematic audit and repair of the Sentry-Pod codebase to identify incomplete edits, configuration mismatches, and code issues that would break the dev build. Completed in three phases: dependency repair, infrastructure config alignment, and a cross-platform integration smoke test.

## What Changed

### Created
- `watchman/scripts/smoke_test.py` — Cross-platform smoke test for the full Sentry-Pod stack (containers, API, DB, frontend lint, frontend dev server)

### Modified
- `frontend/package.json` — Added `eslint-plugin-react@^7.37.5` to `devDependencies` (was missing; broke `npm run lint`)
- `podman-compose.yaml` — Renamed `DATABASE_URL` → `MONGO_URI` to match what `watchman/app/database.py` reads; changed DB name from `sentry_nms` → `sentry_pod_db` to match the rest of the codebase
- `AGENTS.md` — Added Phase 2 documentation for fixing hardcoded API URLs, a summary of fixes applied, and the smoke test usage

## Architecture

Containers are the deployment target, but the frontend dev server runs directly on the host via Vite:

```
┌─────────────────┐     ┌──────────────┐     ┌──────────────┐
│  Browser        │────>│  Frontend    │     │  Watchman    │
│  (Windows/Linux)│     │  Vite :5173  │     │  API :8000   │
└─────────────────┘     └──────┬───────┘     └──────┬───────┘
                               │  HTTP (CORS)       │
                               │                     │
                               │              ┌──────┴───────┐
                               │              │  MongoDB     │
                               │              │  :27017      │
                               │              └──────────────┘
                               │
                         Tailscale ─── GNS3 network (Cisco devices)
```

## Audit Findings Summary

### Critical (repaired)
| Issue | Root Cause | Fix |
|---|---|---|
| `npm run lint` crashes | `eslint-plugin-react` not in `package.json` | Added to `devDependencies` |
| Backend ignores compose env | Compose sets `DATABASE_URL`, code reads `MONGO_URI` | Renamed to `MONGO_URI` |
| DB name mismatch | Compose uses `sentry_nms`, code uses `sentry_pod_db` | Standardized to `sentry_pod_db` |

### Medium (documented for later)
| Issue | Scope |
|---|---|
| 22 hardcoded API URLs | 9 frontend files bypass `VITE_API_BASE_URL` — documented in `AGENTS.md` "TODO" section |
| CORS origins missing ports | `main.py` hardcodes `localhost:5173` instead of using `settings.BACKEND_CORS_ORIGINS` |
| `command-center` Login has no auth | Just redirects on submit |
| `TopologyMap.jsx` is a stub | Placeholder component |

### Minor (pre-existing / cosmetic)
| Issue | Notes |
|---|---|
| 21 ESLint errors | Pre-existing unused variables in `DiffViewer.jsx`, `ExportLogsModal.jsx`, `AiChat.jsx` |
| Stale `app/route/` and `app/service/` dirs | Orphaned `__pycache__` from old structure |
| No `__init__.py` in Python packages | Works at runtime, blocks `pytest`/`mypy` |

## File-by-File Detail

### 1. `frontend/package.json`

Added to `devDependencies`:
```json
"eslint-plugin-react": "^7.37.5",
```
Version 19.x does not exist — `eslint-plugin-react` follows its own semver.

### 2. `podman-compose.yaml`

Line 22 before:
```yaml
DATABASE_URL: mongodb://sentry_pod:Admin123@vault:27017/sentry_nms?authSource=admin
```
After:
```yaml
MONGO_URI: mongodb://sentry_pod:Admin123@vault:27017/sentry_pod_db?authSource=admin
```
Two changes: env var name matches `database.py:10`, DB name matches `database.py:16`.

### 3. `watchman/scripts/smoke_test.py`

Cross-platform Python smoke test (no external dependencies). Runs 8 checks:

| Check | Method | Notes |
|---|---|---|
| Container status | `podman ps` | Graceful for host-mode dev |
| Ansible image | `podman image exists` | — |
| API root | `GET /api` | Verifies FastAPI is alive |
| DB connectivity | `GET /api/network/device-status` | Proves MongoDB connection |
| Active devices | `GET /api/network/active-devices` | Validates nmap output |
| nmap scan | `POST /api/network/active-devices/scan` | Slow (~3min), skipped with `--quick` |
| Frontend lint | `npm run lint` | Reports error/warning counts (pre-existing) |
| Frontend dev server | Start Vite, check `:5173` | Slow, skipped with `--quick` |
| Frontend build | `npm run build` | Verifies production build |

Flags: `--quick`, `--skip-env`, `--backend-only`, `--frontend-only`.

### 4. `AGENTS.md`

Added three sections:
- **"TODO: Fix hardcoded API URLs in frontend"** — Lists all 9 files and 22 locations with the exact fix approach for each (use `API_BASE` constant or migrate to `api` import)
- **"Fixed during audit"** — Summary of the three critical fixes
- Smoke test commands added to "Key commands" section

## Data Flow

```
Developer runs:
    python watchman/scripts/smoke_test.py --quick

         │
         ├── Tools check           (podman, node, npm, python3)
         ├── Container check       (podman ps → should see vault, watchman, syslog-ng)
         ├── Ansible image check   (podman image exists sentry-ansible)
         ├── API root check        (GET http://localhost:8000/           → 200)
         ├── DB check              (GET http://localhost:8000/.../device-status → 200)
         ├── Devices check         (GET http://localhost:8000/.../active-devices → device list)
         ├── Frontend lint         (cd frontend && npm run lint         → exit code 0 or error report)
         │
         └── Results: N passed, 0 failed, M skipped
```

## Usage

### From the CLI

```bash
# Full smoke test (takes ~3min due to nmap scan)
python watchman/scripts/smoke_test.py

# Quick mode (skips nmap scan + frontend dev server check)
python watchman/scripts/smoke_test.py --quick

# Backend only (no frontend checks)
python watchman/scripts/smoke_test.py --backend-only

# Frontend only (no container/backend checks)
python watchman/scripts/smoke_test.py --frontend-only --quick

# Skip environment tool checks (if you've already verified them)
python watchman/scripts/smoke_test.py --quick --skip-env
```

## Design Notes

- The smoke test deliberately uses only the Python standard library to avoid any dependency pre-requisite beyond what Sentry-Pod already requires.
- Container checks are lenient: `watchman` may run directly on the host via `uvicorn` during development, so a missing container is logged as info, not failure.
- The nmap scan (POST) is separated from the active devices read (GET) because scanning is destructive (overwrites `active_devices.json`) and slow.
- ESLint pre-existing errors (21) are reported but do not fail the smoke test — they were present before the audit and are unrelated to the fixes.
- `--quick` exists because nmap scanning takes up to 3 minutes and the frontend dev server test requires starting/killing a Vite process.
