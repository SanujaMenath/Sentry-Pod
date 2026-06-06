# Migration Guide: From Host Ansible to Podman Container

## Overview

Migrate from running Ansible directly on your host machine to an isolated, cross-platform containerized approach. Ansible runs inside a `sentry-ansible` Podman container managed by a single Python script that also orchestrates the full Sentry-Pod stack (vault, watchman, syslog-ng, command-center).

## What Changed

### Before (Host Ansible)
- Ansible installed directly on the host machine
- `ansible-playbook` executed natively — different setup for Windows vs Linux
- Potential Python version conflicts with other projects
- No containerization for the broader Sentry-Pod stack

### After (Containerized)
- Ansible runs inside `sentry-ansible` Podman container — same environment everywhere
- Full stack orchestrated via `container_manager.py` — one script for build, start, stop, status
- SELinux volume flags (`:Z`/`:z`) automatically handled on Linux; stripped on Windows/macOS
- Cross-platform: Linux, Windows (Podman Desktop), and macOS

### Files Created
- `watchman/Dockerfile.ansible` — Ubuntu 24.04 with Ansible, SNMP, nmap, cisco.ios collection
- `docs/CONTAINER_MANAGEMENT.md` — comprehensive container management documentation

### Files Modified
- `watchman/scripts/container_manager.py` — extended from single-container manager to full-stack orchestrator (build all/selective, up, down, status)
- `podman-compose.yaml` — added `build: ./command-center` so `podman-compose build` covers all three compose services

## Architecture

```
┌──────────────────┐      ┌──────────────────────────────────────────┐
│  User / CI       │────▶│          container_manager.py            │
└──────────────────┘      │                                          │
                          │  build all |  up  |  down  |  status     │
                          │  run <playbook>  |  shell                │
                          └──────┬───────────────────────┬───────────┘
                                 │                       │
                                 ▼                       ▼
              ┌────────────────────────┐    ┌───────────────────────┐
              │  podman-compose        │    │  podman (direct)      │
              │  builds & manages:     │    │  builds & runs:       │
              │  ┌──────────────────┐  │    │  sentry-ansible       │
              │  │ vault (MongoDB)  │  │    │  (ephemeral runner)   │
              │  │ watchman(API)    │  │    └───────────────────────┘
              │  │ syslog-ng        │  │
              │  │ command-center   │  │
              │  └──────────────────┘  │
              └────────────────────────┘
                                │
                                ▼
              ┌────────────────────────┐
              │  Podman Desktop /      │
              │  Podman Engine         │
              │  (Linux: native,       │
              │   Win/Mac: VM)         │
              └────────────────────────┘
```

## File-by-File Detail

### 1. `watchman/scripts/container_manager.py`

The single entry point. New commands:

| Command | What it does |
|---|---|
| `build all` | Builds all 4 images (watchman, syslog-ng, command-center via compose; sentry-ansible via direct podman) |
| `build <name>` | Builds one: `watchman`, `syslog-ng`, `command-center`, `ansible` |
| `up` | Starts the full compose stack in detached mode |
| `down` | Stops the compose stack |
| `status` / `check` | Shows podman version, podman-compose version, and image presence |

Cross-platform logic:
- On Linux: original `podman-compose.yaml` used as-is; `:Z`/`:z` SELinux flags preserved
- On Windows/macOS: temp copy of compose file with SELinux flags stripped; `--network=host` omitted

### 2. `podman-compose.yaml`

Now has `build: ./command-center` alongside `image: fresh-command-center`. This lets `podman-compose build` build the React/nginx UI and tag it as `fresh-command-center`, making `build all` work from a single compose invocation.

### 3. `watchman/Dockerfile.ansible`

Ubuntu 24.04 with Ansible, `cisco.ios` collection, SSH legacy algorithm support (`diffie-hellman-group1-sha1`, `ssh-rsa`), SNMP, and nmap. This is the playbook execution environment, built as `sentry-ansible`.

## Data Flow

```
Migration workflow for a new user:

1. Install Podman Desktop
   ↓
2. python container_manager.py build all
   ├── podman-compose build  (watchman, syslog-ng, command-center)
   └── podman build -t sentry-ansible  (Ansible runner)
   ↓
3. python container_manager.py up
   └── podman-compose up -d  (starts vault, watchman, syslog-ng, command-center)
   ↓
4. python container_manager.py run get_facts.yml
   └── podman run --rm -v playbooks:/ansible sentry-ansible ansible-playbook ...
```

## Usage

### From the CLI

```bash
# One-time setup
pip install podman-compose
python watchman/scripts/container_manager.py build all

# Start the stack
python watchman/scripts/container_manager.py up

# Run a playbook (works on all platforms)
python watchman/scripts/container_manager.py run get_facts.yml
python watchman/scripts/container_manager.py run get_facts.yml -i production_hosts.ini

# Open an interactive shell inside sentry-ansible
python watchman/scripts/container_manager.py shell

# Check status
python watchman/scripts/container_manager.py status

# Stop everything
python watchman/scripts/container_manager.py down
```

### From the UI

1. Navigate to `http://localhost:3000` (command-center)
2. Go to **AI Chat Console** or **Playbook Catalog**
3. Select a playbook and execute — runs inside the `sentry-ansible` container automatically

### Via the API

```bash
# Execute a playbook
curl -X POST http://localhost:8000/playbooks/execute \
  -H "Content-Type: application/json" \
  -d '{"name": "get_facts.yml"}'

# Streaming execution
curl http://localhost:8000/playbooks/execute-stream/get_facts.yml
```

## Design Notes

- **Why `container_manager.py` instead of just `podman-compose`?** The `sentry-ansible` container is ephemeral (runs a playbook and exits), so it doesn't belong in the long-running compose stack. A single Python script unifies both workflows.
- **SELinux handling:** Linux requires `:Z`/`:z` for Podman bind mounts under SELinux. These flags are invalid on Windows/macOS where Podman runs in a VM. The script strips them automatically at runtime.
- **`--network=host`** is only used on Linux where it gives optimal network performance. On Windows/macOS, the Podman VM handles networking differently and this flag is omitted.
- **Windows paths:** All path handling uses `pathlib.Path`, which normalizes separators automatically for the host OS.
- **No Docker dependency:** Podman was chosen over Docker because it is daemonless, rootless by default, and works identically on Linux and via Podman Desktop on Windows/macOS.
