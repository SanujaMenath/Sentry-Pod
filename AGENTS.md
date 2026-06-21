# Sentry-Pod

Containerized NMS for Cisco-centric networks. FastAPI backend + React/Vite UI + MongoDB + Ansible in Podman.

## Services

| Service | Dir | Stack | Port | Notes |
|---|---|---|---|---|
| vault | `vault/` | MongoDB | 27017 | Data in `vault-data` volume |
| watchman | `watchman/` | FastAPI + motor (async MongoDB) | 8000 | Main backend |
| frontend | `frontend/` | React 19 + Vite + Tailwind | 5173 (dev), 3000 (prod/nginx) | Single UI; prod via `Dockerfile.prod` |

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

- **No test framework** detected in any service.
- `frontend/` is the single canonical UI, serving both dev (Vite) and production (nginx via `Dockerfile.prod`).
- `NetworkDevices.jsx` exists at repo root (legacy).
- `.env` files contain hardcoded MongoDB credentials (`Admin123`). Not for prod use.
- `HUGGINGFACE_API_KEY` env var required for LLM chat. Can also be set via the UI's API key management endpoints.
- LLM uses HuggingFace Router API (`router.huggingface.co/v1/chat/completions`). Supported models in `llm_routes.py:SUPPORTED_MODELS`.

## Env vars (watchman .env)

```
DB_USER=<mongo_user>
DB_PASS=<mongo_pass>
DB_HOST=<mongo_host>
SECRET_KEY=<jwt_secret>
HUGGINGFACE_API_KEY=<hf_token>
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
- **Updated `podman-compose.yaml`**: `command-center` service replaced by `frontend` service pointing at `frontend/Dockerfile.prod`.

## Auth: MongoDB connection

**Current setup**: Watchman container connects to **Atlas** (`sentrypod.n5boezy.mongodb.net`). Credentials come from `watchman/.env` which is volume-mounted at `/app/.env` and loaded by `database.py:load_dotenv()`.

**To revert to local vault auth** (e.g. for offline dev):
1. In `podman-compose.yaml`, add `MONGO_URI` back under `watchman.environment`:
   ```yaml
   environment:
     MONGO_URI: mongodb://sentry_pod:Admin123@vault:27017/sentry_pod_db?authSource=admin
   ```
2. Add `depends_on: vault` back to the `watchman` service.
3. Ensure vault is running (`podman-compose up vault`).
4. Run `python watchman/scripts/sync_users.py` to pull users from Atlas to local vault.

## Repo style

- Backend: Python FastAPI, async MongoDB via motor, pydantic-settings for config.
- Frontend: React 19, Tailwind CSS v4, Vite 7, eslint flat config.
- No formatter config (no Prettier/Black/ruff).
- No CI pipelines (`.github/workflows/` is empty).
