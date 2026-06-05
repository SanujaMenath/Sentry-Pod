# Container Management

## Overview

Unified cross-platform entry point for building and orchestrating all Sentry-Pod containers. A single Python CLI (`container_manager.py`) handles image builds, compose stack lifecycle, and Ansible playbook execution, adapting automatically to Linux (SELinux) and Windows/macOS (Podman Desktop).

## What Changed

### Created
- `docs/CONTAINER_MANAGEMENT.md` — this document

### Modified
- `watchman/scripts/container_manager.py` — extended from single-container (`sentry-ansible`) manager to full-stack manager with `build`, `up`, `down`, `status` commands
- `podman-compose.yaml` — added `build: ./command-center` to the `command-center` service so `podman-compose build` covers all three compose services

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                  container_manager.py                    │
│                                                          │
│  build [all|watchman|syslog-ng|command-center|ansible]   │
│  up / down                                               │
│  status / check                                          │
│  run <playbook> / shell                                  │
└──────────┬───────────────────────────────────────────────┘
           │
     ┌─────┴─────────────────────┐
     │                           │
     ▼                           ▼
podman-compose (3 svcs)    podman (sentry-ansible)
     │                           │
     ├── vault (mongo:latest)    └── ephemeral container
     ├── watchman (FastAPI)           run --rm
     ├── syslog-ng (syslog)           playbooks mounted
     └── command-center (nginx)       as /ansible
```

## File-by-File Detail

### 1. `watchman/scripts/container_manager.py`

Central CLI driven by `argparse`. On non-Linux systems, SELinux volume flags (`:Z`, `:z`) are stripped from a temporary copy of `podman-compose.yaml` before execution:

```python
def _get_compose_file(self) -> Path:
    if self.is_linux:
        return self.compose_file
    content = self.compose_file.read_text(encoding="utf-8")
    content = re.sub(r":[Zz](?=\s*$|\s+#)", "", content, flags=re.MULTILINE)
    # write to temp file, register cleanup
```

All compose commands delegate to `podman-compose`; the `sentry-ansible` utility container is managed with direct `podman` calls.

### 2. `podman-compose.yaml`

Defines four services — vault (MongoDB), watchman (FastAPI backend), syslog-ng (UDP syslog listener), and command-center (React/nginx UI). The `command-center` service now has both `build` and `image` keys so `podman-compose build` tags the result as `fresh-command-center`.

### 3. Dockerfiles

| File | Base Image | Produces |
|---|---|---|
| `watchman/Dockerfile` | `python:3.11-slim` | `watchman` FastAPI service |
| `watchman/Dockerfile.syslog-ng` | `ubuntu:24.04` | `syslog-ng` listener |
| `watchman/Dockerfile.ansible` | `ubuntu:24.04` | `sentry-ansible` (Ansible runner) |
| `command-center/Dockerfile` | `node:20` → `nginx:alpine` | `fresh-command-center` (React UI) |

## Data Flow

```
User runs:
  python container_manager.py build all
       │
       ├── podman-compose build  → builds watchman, syslog-ng, command-center
       └── podman build -f Dockerfile.ansible → builds sentry-ansible

User runs:
  python container_manager.py up
       │
       └── podman-compose -f <compose_file> up -d
               ├── vault (MongoDB, port 27017)
               ├── watchman (FastAPI, port 8000)
               ├── syslog-ng (UDP 10514)
               └── command-center (nginx, port 3000)

User runs:
  python container_manager.py run get_facts.yml
       │
       └── podman run --rm -v playbooks:/ansible sentry-ansible
               └── ansible-playbook /ansible/get_facts.yml
```

## Usage

### From the CLI

```bash
# Build everything (one-time)
python watchman/scripts/container_manager.py build all

# Build a single container
python watchman/scripts/container_manager.py build watchman
python watchman/scripts/container_manager.py build command-center
python watchman/scripts/container_manager.py build ansible

# Start the full stack
python watchman/scripts/container_manager.py up

# Check status
python watchman/scripts/container_manager.py status

# Stop everything
python watchman/scripts/container_manager.py down

# Run a playbook in sentry-ansible
python watchman/scripts/container_manager.py run get_facts.yml

# Open an interactive shell
python watchman/scripts/container_manager.py shell
```

### From the UI

1. Navigate to `http://localhost:3000` (command-center)
2. The UI communicates with the watchman API at port 8000
3. Playbooks can be triggered from the playbook catalog page

### Via the API

All playbook execution is proxied through the watchman FastAPI backend:

```bash
# Blocking playbook execution
curl -X POST http://localhost:8000/playbooks/execute \
  -H "Content-Type: application/json" \
  -d '{"name": "get_facts.yml"}'

# Streaming playbook execution (SSE)
curl http://localhost:8000/playbooks/execute-stream/get_facts.yml

# Drift analysis
curl -X POST http://localhost:8000/playbooks/drift/refresh

# Baseline collection
curl -X POST http://localhost:8000/playbooks/baseline/refresh
```

## Design Notes

- **Why podman-compose instead of managing everything in Python?** The compose stack (vault, watchman, syslog-ng, command-center) has inter-service dependencies (`depends_on`), named volumes, and port mappings that compose handles declaratively. Reimplementing that in pure Python would be error-prone and harder to maintain. The script wraps compose rather than replacing it.

- **SELinux handling:** Linux requires `:Z` / `:z` volume flags for Podman to access bind-mounted directories under SELinux enforcement. These flags are invalid on Windows/macOS where SELinux does not exist. The script strips them at runtime via a temporary compose file that is cleaned up on exit.

- **Why `build all` as default?** New users most often need to build everything. Individual build targets are available for iterative development (e.g., rebuilding only `watchman` after a code change accelerates `docker build` caching).

- **`sentry-ansible` stays separate from compose:** The Ansible container is ephemeral — it runs a playbook and exits. It does not belong in the long-running compose stack. It is built and managed with direct `podman` commands rather than through compose.

- **`command-center` image name:** The compose file uses `image: fresh-command-center` alongside `build: ./command-center`. This pins a stable tag name so that `podman-compose build` tags the result predictably, and the `status` command can check for its existence.
