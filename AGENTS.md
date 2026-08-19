# Sentry-Pod

Containerized NMS for Cisco-centric networks. FastAPI backend + React/Vite UI + MongoDB + Ansible in Podman.

## Services

| Service | Dir | Stack | Port | Notes |
|---|---|---|---|---|
| vault | `vault/` | MongoDB | 27017 | Data in `vault-data` volume |
| watchman | `watchman/` | FastAPI + motor (async MongoDB) | 8000 | Main backend |
| command-center | `frontend/` | React 19 + Vite + Tailwind | 5173 (dev), 3000 (prod/nginx) | Production compose service; code in `frontend/`; dev via `npm run dev` |

## Key commands

```bash
# Start everything (from repo root)
podman-compose up

# Start backend alone (dev, hot-reloads)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
# cd watchman first

# Frontend dev server
cd frontend && npm run dev    # port 5173

# Lint frontend
cd frontend && npm run lint

# Build frontend
cd frontend && npm run build

# Backend tests (sync engine)
cd watchman && python -m pytest tests/ -q

# Ansible container management (from repo root)
python watchman/scripts/container_manager.py build   # build sentry-ansible image
python watchman/scripts/container_manager.py run <playbook>   # run playbook
python watchman/scripts/container_manager.py shell   # interactive container shell
python watchman/scripts/container_manager.py check   # verify setup

# Smoke test (full stack health check)
python watchman/scripts/smoke_test.py               # full test
python watchman/scripts/smoke_test.py --quick        # skip nmap + frontend server check
python watchman/scripts/smoke_test.py --backend-only # backend + containers only
python watchman/scripts/smoke_test.py --frontend-only # frontend only
```

## Architecture notes

- **Backend tests**: `pytest` in `watchman/tests/` (sync engine). No test framework in frontend.
- `frontend/` is the single canonical UI, serving both dev (Vite) and production (nginx via `Dockerfile.prod`).
- `NetworkDevices.jsx` exists at repo root (legacy).
- `.env` files contain hardcoded MongoDB credentials (`Admin123` for vault, Atlas creds for `ATLAS_URI`). Not for prod use.
- `HUGGINGFACE_API_KEY` env var required for LLM chat. Can also be set via the UI's API key management endpoints.
- LLM uses HuggingFace Router API (`router.huggingface.co/v1/chat/completions`). Supported models in `llm_routes.py:SUPPORTED_MODELS`.

## Env vars (watchman .env)

```
DB_USER=<mongo_user>
DB_PASS=<mongo_pass>
DB_HOST=<mongo_host>
MONGO_URI=<runtime_db_uri>            # local vault (compose overrides to `vault` hostname)
ATLAS_URI=<atlas_srv_uri>             # shared source of truth (sync only)
SECRET_KEY=<jwt_secret>
HUGGINGFACE_API_KEY=<hf_token>
AUDIT_SYNC_WINDOW_DAYS=30             # optional; caps audit_logs sync lookback
```

## API conventions

- All endpoints prefixed per router (e.g. `/llm/chat`, `/playbooks/execute`, `/api/network/devices`).
- JWT auth expected via `Authorization: Bearer <token>` header. 401 auto-redirects to `/login` on frontend.
- Playbook execution has both blocking (`POST /playbooks/execute`) and SSE-streaming (`GET /playbooks/execute-stream/{name}`) variants.
- Chat sessions persisted in MongoDB `conversations` collection; last 10 messages sent as context.

## Ansible quirks

- Playbooks run **only inside the `sentry-ansible` Podman container**, never on the host.
- Container includes `cisco.ios` collection and legacy SSH cipher config (diffie-hellman-group1-sha1, ssh-rsa).
- Playbook catalog at `watchman/playbooks/catalog.json` drives the suggestion engine and UI.
- `host_key_checking = False` in ansible.cfg.
- Add new playbooks: write `.yml` in `playbooks/`, add entry in `catalog.json`.

## Fixed during Phase 2 — Hardcoded API URLs

All frontend API calls now use `import.meta.env.VITE_API_BASE_URL` (with fallback). Details:

- **`auditService.js`**, **`userService.js`**: Already used centralized `api` axios instance.
- **`llmService.js`**, **`Dashboard.jsx`**, **`AiChat.jsx`**, **`DriftReports.jsx`**, **`DriftReportDetail.jsx`**: All fetch calls use `${API_BASE}` where `API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://...fallback...'`.
- **`SetupWizard.jsx`**: Inline fetch calls use `import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"`.
- **`ApiKeyModal.jsx`**: Fixed bug — fallback was literal `'${API_BASE}'` string, changed to proper `'http://localhost:8000'`.
- **`networkService.js`**: Uses `api` instance and `import.meta.env.VITE_API_BASE_URL` for WebSocket URLs.
- **`api.js`** (central axios): Already uses `import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'`.

## Fixed during audit

- **`frontend/package.json`**: Added `eslint-plugin-react@^7.37.5` to `devDependencies` (was missing, broke `npm run lint`).
- **`podman-compose.yaml`**: Renamed `DATABASE_URL` → `MONGO_URI` to match what `database.py` reads; changed DB name from `sentry_nms` → `sentry_pod_db` to match the code.

## Phase 1 optimizations (completed)

- **Merged `command-center/` into `frontend/`**: Removed ~80 duplicated source files (~380KB). `command-center/` directory deleted. Frontend now serves both dev and production (via `Dockerfile.prod` + `nginx.conf`).
- **Cherry-picked improvements**: SessionSidebar double-click-to-confirm delete UX; removed `alert()` dialog in AiChat (uses `console.error` instead).
- **Removed malformed playbook**: `xx.yml` and its catalog entry deleted.
- **Updated `podman-compose.yaml`**: renamed `frontend` service back to `command-center`, sourcing build from `frontend/Dockerfile.prod`.

## Auth: MongoDB connection & Atlas sync

**Runtime DB**: the local `vault` container. `podman-compose.yaml` sets
`MONGO_URI=mongodb://sentry_pod:Admin123@vault:27017/sentry_pod_db?authSource=admin`
under `watchman.environment` (overrides `.env`). For host-side dev, `watchman/.env`
sets `MONGO_URI` to `127.0.0.1:27017` — ensure vault is running.

**Atlas = shared source of truth (sync only)**: `ATLAS_URI` in `watchman/.env`.
Git-style per-document sync, launch + manual only (Settings → Atlas Sync). Hard
rule: Atlas unreachable/unset ⇒ everything runs local, sync skipped with a warning.

- Synced collections: `users`, `api_keys`, `audit_logs`, `devices`,
  `notification_preferences`, `playbooks`. The playbook YAML files live in git;
  the DB metadata (name/description/tags/scope/status) syncs and is deduped by
  `filename` (conflict-by-key). `file_path`, `last_executed`, and derived
  timestamps are excluded from hashing so they never churn.
- Merge states: incoming / local_only / conflict (keep-incoming default) /
  deletion (Atlas authoritative, manifest-based) / delete-vs-modify.
- `users.recent_activities` is ignored for hashing (avoids churn conflicts);
  password/role changes propagate keep-incoming.
- Endpoints (Super Admin): `GET/POST /api/sync/status|run`, `POST /api/sync/resolve`,
  `GET/POST /api/backups`, `POST /api/backups/restore/{name}`, `GET /api/system/health`
  (public; drives the "Vault Offline" pill in the Navbar).
- Non-blocking background scan on startup (`main.py` lifespan); never blocks boot.
- Known v1 limits: no keep-both, no continuous sync, concurrent local pushes are
  last-write-wins, `api_keys` resolves binary keep-incoming.
- Old one-time migration `scripts/sync_users.py` is retired (superseded by the engine).

## Repo style

- Backend: Python FastAPI, async MongoDB via motor, pydantic-settings for config.
- Frontend: React 19, Tailwind CSS v4, Vite 7, eslint flat config.
- No formatter config (no Prettier/Black/ruff).
- No CI pipelines (`.github/workflows/` is empty).
