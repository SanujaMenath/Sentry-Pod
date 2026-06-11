# Sentry-Pod

Containerized NMS for Cisco-centric networks. FastAPI backend + two React/Vite UIs + MongoDB + Ansible in Podman.

## Services

| Service | Dir | Stack | Port | Notes |
|---|---|---|---|---|
| vault | `vault/` | MongoDB | 27017 | Data in `vault-data` volume |
| watchman | `watchman/` | FastAPI + motor (async MongoDB) | 8000 | Main backend |
| command-center | `command-center/` | React 19 + Vite + Tailwind, nginx-served | 3000 | Production UI build |
| frontend | `frontend/` | React 19 + Vite + Tailwind | 5173 (dev) | Dev-mode UI |

## Key commands

```bash
# Start everything (from repo root)
podman-compose up

# Start backend alone (dev, hot-reloads)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
# cd watchman first

# Frontend dev servers
cd frontend && npm run dev    # port 5173
cd command-center && npm run dev  # port 5174

# Lint frontends
cd frontend && npm run lint
cd command-center && npm run lint

# Build frontends
npm run build   # either frontend/

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
- `brain/`, `deployments/` dirs are empty placeholders.
- `watchman/app/route/` and `watchman/app/service/` are stale empties; actual routes are in `routes/`, services in `services/`.
- The `frontend` dir is for dev; `command-center` is the same app but built for production (nginx). Both are independently runnable.
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

## TODO: Fix hardcoded API URLs in frontend

**9 files, 22 locations** hardcode `http://localhost:8000` / `http://127.0.0.1:8000` instead of using `VITE_API_BASE_URL` or the centralized `api.js` axios instance.

**How to fix each file:**

1. **Services** (`auditService.js`, `userService.js`): Replace `axios.create({baseURL: 'http://localhost:8000'})` with `import api from './api'` and use `api.get/post` calls (the centralized instance already uses `VITE_API_BASE_URL`).

2. **Raw `fetch()` calls** (Dashboard.jsx, DriftReports.jsx, DriftReportDetail.jsx, ApiKeyModal.jsx): Add at top of file:
   ```js
   const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
   ```
   Then replace `fetch("http://127.0.0.1:8000/...")` with `` fetch(`${API_BASE}/...`) ``.
   
   For Dashboard.jsx specifically, the 9 fetch calls should be migrated to use the imported `api` axios instance where possible.

3. **SSE streams** (AiChat.jsx line 270: `EventSource(...)`): Pass the env-var-based URL instead of hardcoded. Axios doesn't support SSE, so use the `API_BASE` constant approach.

4. **llmService.js**: Replace hardcoded URL with `import.meta.env.VITE_API_BASE_URL`.

**Files involved:**
| File | Lines | Approach |
|---|---|---|
| `frontend/src/services/auditService.js` | 3 | Use `api` import |
| `frontend/src/services/userService.js` | 3 | Use `api` import |
| `frontend/src/services/llmService.js` | 2 | Use `API_BASE` constant |
| `frontend/src/pages/Dashboard.jsx` | 83,97,111,127,139,153,172,185,207 | Use `api` import |
| `frontend/src/pages/AiChat.jsx` | 196,270 | Use `API_BASE` constant |
| `frontend/src/pages/DriftReports.jsx` | 13 | Use `API_BASE` constant |
| `frontend/src/pages/DriftReportDetail.jsx` | 18 | Use `API_BASE` constant |
| `frontend/src/components/ApiKeyModal.jsx` | 18,43,77,109 | Use `API_BASE` constant |

## Fixed during audit

- **`frontend/package.json`**: Added `eslint-plugin-react@^7.37.5` to `devDependencies` (was missing, broke `npm run lint`).
- **`podman-compose.yaml`**: Renamed `DATABASE_URL` → `MONGO_URI` to match what `database.py` reads; changed DB name from `sentry_nms` → `sentry_pod_db` to match the code.

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
