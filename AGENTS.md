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

## Repo style

- Backend: Python FastAPI, async MongoDB via motor, pydantic-settings for config.
- Frontend: React 19, Tailwind CSS v4, Vite 7, eslint flat config.
- No formatter config (no Prettier/Black/ruff).
- No CI pipelines (`.github/workflows/` is empty).
