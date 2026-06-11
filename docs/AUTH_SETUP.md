# Auth & Build Fixes

## Overview

Watchman container was failing to build and authenticate. Dockerfiles used short image names (`nginx:alpine`) that Podman 5.8.2 on Fedora 44 can't resolve without unqualified-search registries. The command-center Dockerfile's `COPY dist` was blocked by a `.dockerignore` rule. Authentication worked on host uvicorn (Atlas) but not in the container because `podman-compose.yaml` overrode `MONGO_URI` to point at a local vault container with no users.

A deep audit also uncovered additional issues: short-name references in playbook service scripts (`sentry-ansible`), a UTF-16 encoded `requirements.txt` breaking pip, a broken SSH legacy cipher config in the Ansible Dockerfile (Ansible SSH connections silently failed), `--reload` left on in production uvicorn, no `.dockerignore` exposing secrets to image layers, hardcoded CORS origins, a DB_NAME mismatch between config and database layers, and a truncated syslog severity array.

## What Changed

### Modified
- `podman-compose.yaml` — Removed `MONGO_URI` override and `depends_on: vault` from watchman service. Container now reads Atlas credentials from `watchman/.env` via `load_dotenv()`.
- `podman-compose.yaml` — `image: fresh-command-center` → `image: localhost/fresh-command-center` (short-name fix)
- `command-center/Dockerfile` — `FROM nginx:alpine` → `FROM docker.io/library/nginx:alpine`
- `watchman/Dockerfile` — `FROM python:3.11-slim` → `FROM docker.io/library/python:3.11-slim`
- `watchman/Dockerfile.ansible` — `FROM ubuntu:24.04` → `FROM docker.io/library/ubuntu:24.04`
- `watchman/Dockerfile.syslog-ng` — `FROM ubuntu:24.04` → `FROM docker.io/library/ubuntu:24.04`
- `command-center/.dockerignore` — Removed `dist` from ignore list (was blocking `COPY dist` in Dockerfile)
- `AGENTS.md` — Appended local-auth revert instructions
- `watchman/app/services/playbook_service.py:25` — `"sentry-ansible"` → `"localhost/sentry-ansible"` (short-name in podman run commands)
- `watchman/scripts/run_playbook.sh:12` — `CONTAINER_NAME` → `localhost/sentry-ansible`
- `watchman/scripts/smoke_test.py:143` — `"sentry-ansible"` → `"localhost/sentry-ansible"`
- `watchman/requirements.txt` — Re-encoded UTF-16 LE → ASCII (was breaking `pip install -r`)
- `watchman/Dockerfile.ansible:22` — `echo "\n"` → `printf` (dash shell doesn't interpret escape sequences; SSH legacy cipher config was producing literal `\n` strings, silently breaking Cisco SSH connections)
- `watchman/scripts/entrypoint.sh:13` — Removed `--reload` flag (dev-only flag wastes CPU/memory in production via file-watcher)
- `watchman/app/main.py:16-19` — CORS origins now read from `settings.BACKEND_CORS_ORIGINS` instead of hardcoded list
- `watchman/app/core/config.py:22` — `DB_NAME` default `"watchman"` → `"sentry_pod_db"` to align with `database.py`
- `watchman/scripts/syslog_listener.sh:5` — Added syslog severity 6 (Informational) and 7 (Debug) to `SEVERITY_NAMES`

### Created
- `watchman/.dockerignore` — Excludes `.env`, `__pycache__`, `.venv`, generated data dirs, and build artifacts from image layers

## Architecture

```
Browser (:3000)
  ↓ POST /login  (username/password)
nginx (command-center container)
  ↓ proxy_pass http://watchman:8000
FastAPI (watchman container)
  ↓ motor AsyncIOMotorClient
MongoDB Atlas (sentrypod.n5boezy.mongodb.net)
  ↓ users collection
returns JWT → stored in localStorage → sent as Bearer token on subsequent requests
```

## File-by-File Detail

### 1. `podman-compose.yaml`

The `watchman` service previously had:

```yaml
depends_on:
  - vault
environment:
  MONGO_URI: mongodb://sentry_pod:Admin123@vault:27017/sentry_pod_db?authSource=admin
```

This forced the container to use a local MongoDB with no users. Removed both lines. The container now falls through to `database.py` which calls `load_dotenv()` → reads `MONGO_URI` from `watchman/.env` (Atlas SRV URI).

### 2. Dockerfiles (4 files)

Podman 5.8.2 on Fedora 44 requires fully-qualified image names. Short names like `nginx:alpine`, `python:3.11-slim`, `ubuntu:24.04` fail with:

```
Error: short-name "nginx:alpine" did not resolve to an alias and
no unqualified-search registries are defined in "registries.conf"
```

Fix: prepend `docker.io/library/` to every `FROM` line.

### 3. `command-center/.dockerignore`

Had `dist` in the ignore list, but the Dockerfile does `COPY dist /usr/share/nginx/html`. The `.dockerignore` filtered out `dist` from the build context, making `COPY` fail with "no items matching glob". Fix: removed `dist` from `.dockerignore`.

### 4. MongoDB: Atlas vs Local Vault

The `.env` file (`watchman/.env`) contains Atlas credentials:

```
MONGO_URI="mongodb+srv://<user>:<password>@<cluster>.mongodb.net/sentry_pod_db"
```

`database.py` loads this via `load_dotenv()` and falls back to `settings.MONGO_URI` (pydantic computed field from `DB_USER`, `DB_PASS`, `DB_HOST`). With the compose override removed, the container correctly uses Atlas.

### 5. `AGENTS.md`

Appended a section under "Auth: MongoDB connection" that documents:
- How the current Atlas connection works
- Step-by-step instructions to revert to local vault auth
- Note about `sync_users.py` for migrating users

### 6. Short-name references in backend services

`playbook_service.py:25`, `run_playbook.sh:12`, `smoke_test.py:143` all used the bare name `sentry-ansible` to reference the Ansible container image. When the watchman container shells out to `podman run`, that short name hits Podman's `short-name-mode = "enforcing"` policy inside the container (separate registries.conf), causing the "did not resolve to an alias" error.

Fix: Use `"localhost/sentry-ansible"` (fully-qualified local name). The `container_manager.py` build tag was already updated in the same session. An alias `sentry-ansible → localhost/sentry-ansible` exists in `/etc/containers/registries.conf`, but explicit qualification is more reliable.

Similarly, `podman-compose.yaml:41` used `image: fresh-command-center` — a short name that has no alias. Changed to `image: localhost/fresh-command-center`.

### 7. `requirements.txt` — UTF-16 encoding

The file was accidentally saved as UTF-16 Little-Endian with BOM. Pip reads requirements files as UTF-8 by default, so `pip install -r requirements.txt` would raise `UnicodeDecodeError`. Fixed by re-encoding to ASCII via `iconv -f UTF-16LE -t UTF-8`.

### 8. `Dockerfile.ansible:22` — Broken SSH legacy cipher config

```dockerfile
# Broken: dash's echo doesn't interpret \n
RUN echo "Host *\n    HostKeyAlgorithms +ssh-rsa\n    ..." > /etc/ssh/ssh_config.d/legacy.conf
```

In Ubuntu 24.04, `/bin/sh` is `dash`, whose `echo` built-in does not interpret `\n` escape sequences. The resulting file contained literal `\n` strings instead of newlines, making the SSH legacy cipher configuration entirely inert. Without this, the Ansible container cannot connect to older Cisco devices using `diffie-hellman-group1-sha1` or `ssh-rsa`.

Fix: Use `printf` which interprets escape sequences consistently across shells.

### 9. `entrypoint.sh:13` — `--reload` in production uvicorn

```bash
# Before
exec uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# After
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The `--reload` flag enables file-watching auto-restart, a development-only feature. In a containerized deployment it adds unnecessary CPU/memory overhead via a file-watcher poll loop. Removed for production.

### 10. `watchman/.dockerignore` — Created

The watchman Dockerfile has `COPY . .` which sends the entire build context into the image. Without a `.dockerignore`, this included:
- `.env` — HuggingFace API key, MongoDB Atlas credentials, JWT secret
- `__pycache__/`, `*.pyc` — Python bytecode
- `.venv/` — Virtual environment
- `nmap_output/`, `snmp_output/` — Generated data
- `playbooks/runningConfigs/`, `playbooks/syslog/` — Device configs with password hashes

The `.dockerignore` now excludes all of these from the build context.

### 11. `main.py:16-19` — Hardcoded CORS origins

CORS `allow_origins` was hardcoded as:
```python
allow_origins=[
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:3000", "http://127.0.0.1:3000",
],
```
Changed to read from `settings.BACKEND_CORS_ORIGINS` (which already had `http://localhost:5174` that the hardcoded list was missing). This keeps the CORS configuration in a single source of truth (`config.py`).

### 12. `config.py:22` — DB_NAME default mismatch

```python
# Before
DB_NAME: str = "watchman"

# After
DB_NAME: str = "sentry_pod_db"
```

The computed `MONGO_URI` fallback used `DB_NAME="watchman"` as the default database, but `database.py:16` hardcodes `client.sentry_pod_db`. If the `MONGO_URI` env variable were ever absent, the fallback would connect to the wrong database. Aligned the default to `sentry_pod_db`.

### 13. `syslog_listener.sh:5` — Truncated severity array

```bash
# Before (6 entries — missing severities 6 and 7)
SEVERITY_NAMES=("Emergency" "Alert" "Critical" "Error" "Warning" "Notification")

# After (all 8 syslog severities)
SEVERITY_NAMES=("Emergency" "Alert" "Critical" "Error" "Warning" "Notification" "Informational" "Debug")
```

Syslog RFC 5424 defines 8 severity levels (0–7). The array had only 6 entries. Severity 6 (`Informational`) and 7 (`Debug`) produced an empty `severity_name` field in forwarded alerts.

## Data Flow

```
User opens http://localhost:3000
  → React app loads (served by nginx in command-center container)
  → Enters username/password on /login
  → POST http://localhost:8000/login (via api.js axios instance)
  → FastAPI auth_routes.py → auth_service.py → users_collection.find_one()
  → MongoDB Atlas verifies credentials
  → Returns JWT {sub, role, exp}
  → Frontend stores token in localStorage
  → Subsequent requests include Authorization: Bearer <token>
  → Protected routes decode token, check exp, redirect to /login if expired
```

## Known Auth Gaps (Not Yet Fixed)

### Services that bypass the centralized `api.js` (no Bearer token sent)

| File | Problem |
|---|---|
| `frontend/src/services/userService.js` | Own axios instance at hardcoded `http://localhost:8000/users` — no auth header |
| `frontend/src/services/auditService.js` | Own axios instance at hardcoded `http://localhost:8000` — no auth header |
| `frontend/src/services/llmService.js` | Raw `fetch("http://localhost:8000/llm/chat")` — no auth header |

### Pages with raw `fetch()` calls (no Bearer token sent)

| File | Locations |
|---|---|
| `frontend/src/pages/Dashboard.jsx` | 9 raw `fetch("http://127.0.0.1:8000/...")` calls |
| `frontend/src/pages/AiChat.jsx` | 2 calls — `fetch` + `EventSource` SSE |
| `frontend/src/pages/DriftReports.jsx` | 1 raw `fetch` call |
| `frontend/src/pages/DriftReportDetail.jsx` | 1 raw `fetch` call |
| `frontend/src/components/ApiKeyModal.jsx` | 4 raw `fetch` calls |

All 22 locations hardcode `http://localhost:8000` or `http://127.0.0.1:8000` instead of using `VITE_API_BASE_URL` from the centralized `api.js` instance. The 401 interceptor in `api.js` won't fire for these calls because they bypass it entirely.

### Registration sets `role: "pending"`

`user_service.py:27` always sets new users to `role: "pending"`. There is no approval workflow. Admins must manually upgrade users via `PUT /users/{id}/role` (requires Super Admin token).

### Super Admin role string mismatch

`dependencies.py:31` checks for the exact string `"Super Admin"`:
```python
if current_user.get("role") != "Super Admin":
```
The `create_admin.py` seed script was setting `"role": "admin"` — a mismatch that silently denies admin access. Registration sets `"role": "pending"`. The correct value is `"Super Admin"` (capital S, capital A).

### `userService.js` and `auditService.js` in both frontend dirs

Both `frontend/` and `command-center/` have identical copies of these files. Fixes must be applied to both directories.

## Usage

### From the CLI — Rebuild after changes

```bash
# Rebuild a single service
podman-compose build watchman

# Rebuild all and restart
python watchman/scripts/container_manager.py build all
podman-compose up -d

# Restart watchman to pick up entrypoint changes (--reload removed)
podman-compose restart watchman
```

### From the CLI — Manage auth

```bash
# Login
curl -X POST http://localhost:8000/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin@123"}'

# Authenticated request
curl http://localhost:8000/users/me \
  -H "Authorization: Bearer <token>"

# Promote an existing user to Super Admin (via API)
# Requires an existing Super Admin token
curl -X PUT http://localhost:8000/users/{user_id}/role \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"role": "Super Admin"}'
```

## Design Notes

- **`.dockerignore` present**: The watchman directory now has a `.dockerignore` to prevent secrets (`.env`), build artifacts (`__pycache__`, `.venv`), and generated data (`nmap_output/`, `snmp_output/`, device configs) from being baked into the image by `COPY . .`.
- **Role string match**: `require_super_admin` in `dependencies.py:31` checks for the exact string `"Super Admin"`. The `create_admin.py` seed script was setting `"admin"` — a mismatch that would silently deny admin access.
- **Registration sets `role: "pending"`**: New users via `POST /users/` always get `role: "pending"`. There's no approval workflow. Admins must manually promote them via `PUT /users/{id}/role`.
- **Local vault is still running**: The `vault` service in `podman-compose.yaml` starts by default even though nothing depends on it. Stop with `podman-compose stop vault` if not needed.
- **No token refresh**: JWT expires after 120 minutes (`ACCESS_TOKEN_EXPIRE_MINUTES`). The frontend `ProtectedRoute` checks `decoded.exp` and redirects to `/login`. No silent refresh mechanism exists.
- **Two frontend directories**: `frontend/` (dev, port 5173) and `command-center/` (production build, nginx port 3000) are clones. Fixes must be applied to both.
- **`--reload` removed**: The `entrypoint.sh` no longer passes `--reload` to uvicorn. This flag enables file-watching which is unnecessary in a container and wastes CPU. If you need hot-reload during development, run uvicorn directly on the host.
- **Short-name discipline**: Every container image reference in code and config now uses either `docker.io/library/...` (for public images) or `localhost/...` (for local builds). This avoids Podman's `short-name-mode = "enforcing"` policy which rejects unqualified names.
- **Syslog severity completeness**: The `SEVERITY_NAMES` array now covers all 8 RFC 5424 severity levels. Previously severities 6 (Informational) and 7 (Debug) produced empty severity_name fields in alerts.
- **`DB_NAME` aligned**: The pydantic `config.py` default and the hardcoded `database.py` database name both use `sentry_pod_db`. If the `MONGO_URI` env var is ever absent, the computed fallback URI will point at the correct database.
