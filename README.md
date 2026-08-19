# Sentry-Pod

Containerized Network Management System for Cisco-centric environments. Uses Intent-Based Networking with AI-powered natural language to Cisco IOS command translation, automated configuration drift detection, SNMP baseline monitoring, syslog intelligence, and Ansible playbook orchestration — all running in Podman containers. The platform is built and tested against a real GNS3-simulated Cisco fabric that is provisioned end-to-end via Ansible Infrastructure-as-Code.

## Key Features

- **AI-Powered IOS Translation** — Describe what you want in natural language; the LLM (HuggingFace Router) generates accurate Cisco IOS commands via the chat console
- **Config Drift Detection** — Ansible playbooks snapshot device running configs and diff them against golden baselines; results rendered as git-style diffs in the UI
- **SNMP Baseline Monitoring** — Collects and parses per-interface telemetry metrics with trend analysis
- **Syslog Intelligence** — Centralized syslog-ng listener with AI-augmented log analysis
- **Playbook Automation** — 20 pre-built Ansible playbooks for Cisco device management (VLAN, OSPF, HSRP, NTP, CDP, SNMP, drift, backup, and more)
- **Atlas Source-of-Truth Sync** — Git-style per-document sync between the local vault and MongoDB Atlas; merge states (incoming / local-only / conflict / deletion) resolved in the UI
- **Session Memory** — LLM chat sessions persisted in MongoDB with context retention (last 10 messages)
- **Cross-Platform** — Runs on Linux (native podman) and Windows/macOS (Podman Desktop) with automatic SELinux handling

## Infrastructure & Automation

Behind the application is a full network-engineering workstream: a GNS3-simulated Cisco enterprise fabric designed, built, and automated as Infrastructure-as-Code. Every feature above — drift detection, playbook orchestration, SNMP baselines, syslog intelligence — is exercised against this live lab.

![Sentry-Pod network topology](https://github.com/KDIAS-JR7/GNS3-Topology-JR7/raw/main/documentation/network_diagram.jpg)

### GNS3 Network Fabric

A redundant, multi-tier enterprise simulation: **16 Cisco devices** (edge routers `R1`/`R2` + EtherSwitches `ESW1–ESW14`) and **8 endpoint PCs** across three functional tiers. The fabric evolved from a three-tier design into a spine-leaf layout with:

- **VLAN matrix & VLSM** — 8 department VLANs (7–14) carved out of `10.1.0.0/16` and `10.2.0.0/16` with proper subnetting
- **Dynamic routing** — OSPF across core/distribution with a self-healing redundant core
- **High availability** — HSRP gateway redundancy, EtherChannel link aggregation, and STP tuning so redundancy doesn't fight itself
- **Management fabric** — out-of-band VLAN 99 for headless SSH access to all 16 devices

Full day-by-day build journal (19 days, including the legacy-IOS SSH crypto struggles): [Sentry-Labs-JR7](https://github.com/KDIAS-JR7/Sentry-Labs-JR7) · Concise design blueprint with topology files: [GNS3-Topology-JR7](https://github.com/KDIAS-JR7/GNS3-Topology-JR7)

### Ansible Automation Suite

**20 production-style playbooks** replace manual CLI screen-scraping with structured, repeatable IaC. The catalog (with names, target device groups, severity, and blast-radius impact) lives in `watchman/playbooks/catalog.json` and drives the UI suggestion engine:

| Area | Playbooks |
|---|---|
| Facts & discovery | `collect_facts.yml`, `show_os_version.yml`, `collect_cdp_neighbors.yml` |
| Drift & baseline | `collect_golden_config.yml`, `collect_running_config.yml`, `check_config_drift.yml` |
| Backup & commit | `backup_and_commit_config.yml` |
| Telemetry & hardening | `configure_snmp.yml`, `configure_ntp.yml`, `configure_ntp_edge.yml`, `configure_syslog.yml`, `set_logging_timestamps.yml` |
| Layer 2 & access | `enable_cdp.yml`, `configure_vlans.yml`, `configure_default_gateway.yml`, `configure_end_device_port.yml` |
| Routing & HA | `configure_ospf.yml`, `configure_vlan_routing.yml`, `configure_hsrp_intervlan.yml`, `configure_hsrp_active.yml` |

All 16 devices are configured with a single command; drift detection snapshots running configs against golden baselines. Full playbook reference with impact categories: [Ansible-JR7](https://github.com/KDIAS-JR7/Ansible-JR7) · Auto-generated catalog table: [PLAYBOOKS.md](watchman/playbooks/PLAYBOOKS.md)

### Telemetry & Ops Plumbing

- **syslog-ng** — all 16 endpoints ship UDP syslog to port `10514`, aggregated per host (`/syslog/$HOST/debug.log`) and fed to the AI log-analysis feature
- **SNMP** — baseline telemetry collection feeding the trend graphs
- **NTP** — fleet clock sync with edge/regional variance handling
- **SSH compatibility** — legacy IOS crypto (diffie-hellman-group1-sha1, ssh-rsa) enabled so modern tooling can reach the lab

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        container_manager.py                         │
│          Single entry point: build | up | down | status | run       │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
     ┌────────▼──────── ┐     ┌─────────▼────────── ┐
     │  podman-compose  │     │  podman (direct)    │
     │                  │     │                     │
     │ ┌──────────────┐ │     │ sentry-ansible      │
     │ │ vault        │ │     │ (ephemeral runner)  │
     │ │ (MongoDB)    │ │     │                     │
     │ │ port 27017   │ │     │ podman run --rm     │
     │ │ (RUNTIME DB) │ │     │ -v playbooks:/ansible│
     │ └──────┬───────┘ │     │ ansible-playbook    │
     │        │         │     └─────────────────────┘
     │ ┌──────▼───────┐ │
     │ │ watchman     │──────┐
     │ │ (FastAPI)    │ │    │  sync engine
     │ │ port 8000    │ │    │  (launch + manual)
     │ └──────┬───────┘ │    ▼
     │        │         │  ┌────────────────────────┐
     │ ┌──────▼───────┐ │  │  MongoDB Atlas (cloud) │
     │ │command-center│ │  │  shared source of      │
     │ │ (React/nginx)│ │  │  truth (sync only)     │
     │ │ port 3000    │ │  └────────────────────────┘
     │ └──────────────┘ │
     │                  │
     │ ┌──────────────┐ │
     │ │ syslog-ng    │ │
     │ │ UDP 10514    │ │
     │ └──────────────┘ │
     └──────────────────┘
```

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Backend | Python / FastAPI / Motor (async MongoDB) | Python 3.11 |
| Frontend (prod) | React 19 / Vite 7 / Tailwind CSS v4 / nginx | Node 20 |
| Frontend (dev) | React 19 / Vite 7 / Tailwind CSS v4 | Node 20 |
| Database | MongoDB | latest |
| Containers | Podman + podman-compose | — |
| Automation | Ansible (cisco.ios collection) | — |
| AI | HuggingFace Router API | — |

## Project Structure

```
sentry-pod/
├── watchman/                    # FastAPI backend
│   ├── app/
│   │   ├── main.py              # App entry point (startup sync scan)
│   │   ├── database.py          # MongoDB connection (motor, reads MONGO_URI)
│   │   ├── core/                # Config, security, dependencies
│   │   ├── models/              # Pydantic/MongoDB models
│   │   ├── routes/              # API route handlers
│   │   │   ├── auth_routes.py       # Login / JWT
│   │   │   ├── user_routes.py       # Users, roles, security activity
│   │   │   ├── playbook_routes.py   # Execute / execute-stream / catalog
│   │   │   ├── llm_routes.py        # AI chat + suggestions
│   │   │   ├── device_routes.py     # Network devices / scans / status / drift reports
│   │   │   ├── network_utils.py     # Shared device/drift/terminal helpers
│   │   │   ├── telemetry_routes.py  # SNMP trend data
│   │   │   ├── syslog_routes.py     # Syslog query + AI analysis
│   │   │   ├── topology_routes.py   # Topology graph / CDP map
│   │   │   ├── terminal_routes.py   # Device terminal (WebSocket)
│   │   │   ├── console_routes.py    # Backend console (WebSocket)
│   │   │   ├── setup_routes.py      # Setup wizard pipeline
│   │   │   ├── notification_routes.py# Notifications + preferences
│   │   │   ├── sync_routes.py       # Atlas sync status / run / resolve
│   │   │   ├── backup_routes.py     # Backups list / create / restore
│   │   │   ├── system_routes.py     # /api/system/health (public)
│   │   │   └── audit_routes.py      # Audit logs
│   │   └── services/            # Business logic
│   │       ├── playbook_service.py   # Podman container integration
│   │       ├── execution_service.py  # Playbook execution + SSE
│   │       ├── catalog_service.py    # Playbook catalog (file + DB)
│   │       ├── drift_service.py      # Drift diff generation
│   │       ├── auth_service.py
│   │       ├── user_service.py
│   │       ├── sync_service.py       # Atlas source-of-truth sync engine
│   │       ├── backup_service.py     # Pure-Python dump/restore
│   │       ├── health_service.py     # Vault ping
│   │       ├── notification_service.py
│   │       ├── setup_service.py
│   │       └── topology_service.py
│   ├── playbooks/               # Ansible playbooks + data
│   │   ├── hosts.ini            # Device inventory
│   │   ├── catalog.json         # Playbook catalog for UI (20 playbooks)
│   │   ├── PLAYBOOKS.md         # Auto-generated catalog table
│   │   ├── configDrift/         # Drift detection outputs
│   │   ├── goldenState/         # Golden baseline configs (GS_* — tracked in git)
│   │   ├── runningConfigs/      # Collected running configs
│   │   ├── syslog/              # Per-device syslog data
│   │   └── snmp_output/         # SNMP telemetry metrics
│   ├── tests/                   # Backend tests (pytest, sync engine)
│   ├── scripts/
│   │   ├── container_manager.py     # Unified container CLI
│   │   ├── smoke_test.py            # Full stack health check
│   │   ├── collect_and_parse_snmp.py# SNMP collect + parse
│   │   ├── nmap_scan.py             # Network discovery
│   │   ├── parse_drift.py           # Drift output parser
│   │   ├── seed_playbook_catalog.py # Seed catalog into MongoDB
│   │   ├── create_admin.py          # Admin user creation
│   │   ├── cleanup_data.py          # Clean old playbook output
│   │   ├── run_playbook.sh / .bat   # Platform wrappers
│   │   ├── run_collect_for_duration.sh
│   │   ├── syslog_listener.sh       # HTTP syslog bridge to API
│   │   └── entrypoint.sh            # watchman container entrypoint
│   ├── Dockerfile                   # watchman container image
│   ├── Dockerfile.ansible           # sentry-ansible image
│   ├── Dockerfile.syslog-ng         # syslog-ng image
│   ├── .env                         # Environment config
│   ├── .dockerignore                # Build context exclusions
│   └── pyproject.toml               # Ruff config
│
├── frontend/                    # React UI (single source of truth; dev + prod via Dockerfile.prod)
│   ├── Dockerfile.prod          # Multi-stage production build (nginx)
│   ├── nginx.conf               # nginx production config
│   ├── package.json
│   ├── src/
│   ├── vite.config.js
│   └── eslint.config.js
│
├── vault/                       # MongoDB runtime data (empty, volume-mounted)
│
├── docs/                        # Feature documentation
│   ├── ATLAS_SYNC.md
│   ├── AUTH_SETUP.md
│   ├── CDP_TOPOLOGY_MAP.md
│   ├── CODEBASE_REFACTOR_2026-06-11.md
│   ├── CODEBASE_REFACTOR_2026-06-21.md
│   ├── CONFIG_DRIFT_AUTOMATION.md
│   ├── CONTAINER_MANAGEMENT.md
│   ├── FRONTEND_SYNC.md
│   ├── HEALTH_CHECK.md
│   ├── HOST_VARS_MANAGEMENT.md
│   ├── IMPLEMENTATION_SUMMARY.md
│   ├── MIGRATION_GUIDE.md
│   ├── NETWORK_BASELINE_AUTOMATION.md
│   ├── NETWORK_BASELINES_AUTOMATION.md
│   ├── ONBOARDING_WORKFLOW.md
│   ├── PLAYBOOK_MODIFICATION.md
│   ├── REAL_TIME_NETWORK_STATUS.md
│   ├── REFRESH_FACTS.md
│   ├── SECURITY_HARDENING.md
│   ├── SESSION_2026-06-11.md
│   ├── SESSION_MEMORY.md
│   └── SYSLOG_INTELLIGENCE.md
│
├── podman-compose.yaml          # Compose stack definition
└── AGENTS.md                    # Developer reference
```

## Prerequisites

- **Podman** — Install from [podman.io](https://podman.io). On Windows/macOS, install **Podman Desktop** (bundles the Podman CLI and manages a VM).
- **podman-compose** — `pip install podman-compose`
- **Python 3.11+** — For running `container_manager.py` on the host
- **Git** — To clone the repo

> **Windows users:** Use **PowerShell**, **Git Bash**, or **WSL** for the commands below — Command Prompt (CMD) does not accept forward-slash paths. Install Python from [python.org](https://python.org) and ensure it is in your PATH.

Verify:
```powershell
podman --version
podman-compose --version
python --version
```

## Quick Start

```bash
# 1. Clone and enter the project
git clone git@github.com:SanujaMenath/Sentry-Pod.git && cd Sentry-Pod

# 2. Build all container images (one-time, ~5-10 min)
#    Builds ansible first (generates sentry-ansible.tar),
#    then compose stack (bakes tar into watchman image)
python watchman/scripts/container_manager.py build all

# 3. Start the full stack
python watchman/scripts/container_manager.py up

# 4. Check everything is running
python watchman/scripts/container_manager.py status

# After code changes, rebuild and restart:
#   python watchman/scripts/container_manager.py build all
```

The UI is available at **http://localhost:3000** (command-center) or **http://localhost:5173** (frontend dev mode).

> **First-time setup:** After starting the stack:
> 1. **Create an admin account** — Sign up at http://localhost:3000, then promote your user to `"Super Admin"` (see [Auth Setup](docs/AUTH_SETUP.md#usage))
> 2. **Configure devices** — Edit `watchman/playbooks/hosts.ini` with your network device credentials
> 3. **Set AI key** — Add `HUGGINGFACE_API_KEY` in `watchman/.env` (or via the UI)
> 4. **Sync from Atlas** — Settings → Atlas Sync → "Sync now" to pull shared collections (optional)
>
> See [Configuration](#configuration) and [SSH / Credential Setup](#ssh--credential-setup) below.

## Services

| Service | Container | Tech | Port | Purpose |
|---|---|---|---|---|
| vault | `sentry-pod_vault_1` | MongoDB | 27017 | Local **runtime database** (all app reads/writes) |
| watchman | `sentry-pod_watchman_1` | FastAPI + Motor | 8000 | REST API backend |
| syslog-ng | `sentry-pod_syslog-ng_1` | syslog-ng | 10514/udp | Centralized syslog collection |
| command-center | `sentry-pod_command-center_1` | React 19 + nginx | 3000 → 80 | Production UI (image `localhost/sentry-pod-command-center`) |
| sentry-ansible | `localhost/sentry-ansible` | Ubuntu + Ansible | — | Ephemeral playbook runner (`--pull=never`, image loaded from `sentry-ansible.tar`) |

## Usage

### CLI (container_manager.py)

```bash
# Build
python watchman/scripts/container_manager.py build all             # all images
python watchman/scripts/container_manager.py build watchman        # single service
python watchman/scripts/container_manager.py build command-center  # frontend UI only
python watchman/scripts/container_manager.py build ansible         # sentry-ansible only

# Stack lifecycle
python watchman/scripts/container_manager.py up     # start all services
python watchman/scripts/container_manager.py down   # stop all services
python watchman/scripts/container_manager.py status # system status

# Ansible playbooks
python watchman/scripts/container_manager.py run collect_facts.yml
python watchman/scripts/container_manager.py run check_config_drift.yml -i hosts.ini
python watchman/scripts/container_manager.py shell   # interactive container shell
```

### UI

| URL | Description |
|---|---|
| http://localhost:3000 | Command Center (production UI) |
| http://localhost:5173 | Frontend (dev mode, see Development section) |
| http://localhost:8000/docs | FastAPI Swagger docs |
| http://localhost:8000/redoc | FastAPI ReDoc |

### API

All endpoints require JWT auth (`Authorization: Bearer <token>`). Get a token via `/auth/login`.

```bash
# Execute a playbook (blocking)
curl -X POST http://localhost:8000/playbooks/execute \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "collect_facts.yml"}'

# Streaming execution (SSE)
curl http://localhost:8000/playbooks/execute-stream/collect_facts.yml \
  -H "Authorization: Bearer <token>"

# Chat with the AI
curl -X POST http://localhost:8000/llm/chat \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"message": "Show me the OSPF config for ESW1"}'

# Network device list
curl http://localhost:8000/api/network/devices \
  -H "Authorization: Bearer <token>"

# Drift reports
curl http://localhost:8000/api/network/drift/reports \
  -H "Authorization: Bearer <token>"

# System health (public — drives the "Vault Offline" pill)
curl http://localhost:8000/api/system/health
```

## Authentication

Login is handled via JWT. The watchman container connects to the **local `vault` MongoDB** at runtime (`MONGO_URI` overridden by `podman-compose.yaml`). **MongoDB Atlas is the shared source of truth for sync only** (`ATLAS_URI`) — it is never required for normal operation.

### Default credentials

After first-time sign-up via the UI, an admin must promote the user to `"Super Admin"`
for full access. See [Auth Setup](docs/AUTH_SETUP.md#usage) for CLI commands.

## Atlas Source-of-Truth Sync

Each operator runs an independent stack against the same lab; Atlas shares stateful/cooperative data between stacks. Sync is **launch + manual only** (Settings → Atlas Sync) and runs a git-style per-document three-way merge:

- **incoming** — `_id` in Atlas only → imported to vault
- **local_only** — `_id` in vault only → pushed to Atlas
- **conflict** — both sides differ → pick keep-incoming (default) or keep-local
- **deletion** — deleted in Atlas since the manifest → deleted locally (Atlas authoritative)

Synced collections: `users`, `api_keys`, `audit_logs`, `devices`, `notification_preferences`, `playbooks`. High-volume/derived data (syslog, notifications, conversations, topology) stays local — "everyone sees the same syslog" is satisfied by deriving from the same lab.

Hard rule: **Atlas unreachable/unset ⇒ everything runs local, sync skipped with a warning.**

Admin-gated endpoints:

| Endpoint | Purpose |
|---|---|
| `GET /api/sync/status` | Pending incoming / local-only / conflicts / deletions |
| `POST /api/sync/run` | Trigger a manual sync |
| `POST /api/sync/resolve` | Resolve conflicts (`incoming` / `local`) |
| `GET/POST /api/backups` | List / create pure-Python vault backups (`watchman/backups/`) |
| `POST /api/backups/restore/{name}` | Restore a backup |
| `GET /api/system/health` | Public vault health check |

See [docs/ATLAS_SYNC.md](docs/ATLAS_SYNC.md) for the full merge model and known v1 limits.

## SSH / Credential Setup

Before playbooks can reach your network devices, configure authentication:

**Option A — SSH key** (recommended):
```ini
; watchman/playbooks/hosts.ini
[switches]
ESW1 ansible_host=192.168.1.1 ansible_user=admin ansible_ssh_private_key_file=/ansible/ssh_key

[routers]
R1 ansible_host=192.168.1.254 ansible_user=admin ansible_ssh_private_key_file=/ansible/ssh_key
```

Place keys in `watchman/playbooks/` (they get mounted into the container at `/ansible/`).

**Option B — Password auth**:
```ini
[switches]
ESW1 ansible_host=192.168.1.1 ansible_user=admin ansible_ssh_pass=your_password
```

> **Security note:** The `.env` and playbook files contain hardcoded credentials (`Admin123`, etc.). These are intended for lab use only. Change them before any production deployment.

## Configuration

The watchman container reads `watchman/.env` (volume-mounted at `/app/.env`). Key variables:

```env
# Runtime DB — local vault (compose overrides to `vault` hostname)
MONGO_URI="mongodb://sentry_pod:Admin123@127.0.0.1:27017/sentry_pod_db?authSource=admin"

# Atlas — shared source of truth (sync only, optional at runtime)
ATLAS_URI="mongodb+srv://<user>:<pass>@sentrypod.n5boezy.mongodb.net/?appName=SentryPod"

# ... or individual fields (pydantic constructs the URI):
DB_USER=<user>
DB_PASS=<pass>
DB_HOST=<host>

# JWT
SECRET_KEY=<change-this-to-a-random-string>

# Required for AI chat
HUGGINGFACE_API_KEY=<your-huggingface-token>

# Optional: caps audit_logs sync lookback
AUDIT_SYNC_WINDOW_DAYS=30
```

The `HUGGINGFACE_API_KEY` can also be set via the UI's API key management page instead of the `.env` file.

**Switching the runtime DB:** See [Auth Setup](docs/AUTH_SETUP.md#reverting-to-local-vault-auth) or `AGENTS.md`.

## Development

### Backend (watchman)

```bash
cd watchman
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Requires MongoDB accessible (the local `vault` container by default — run `podman-compose up vault`).

> For live syslog data, also run the syslog-ng container alongside uvicorn:
> ```bash
> podman-compose up syslog-ng
> ```

### Backend tests

```bash
cd watchman && python -m pytest tests/ -q
```

### Frontend (dev mode)

```bash
cd frontend
npm install
npm run dev     # Hot-reload at http://localhost:5173
```

> **Prerequisites for live syslog:** When running `npm run dev` in `frontend/`, ensure the backend services are also running:
> ```bash
> # Terminal 1: watchman API
> cd watchman && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
>
> # Terminal 2: syslog-ng container
> podman-compose up syslog-ng
>
> # Terminal 3: frontend dev server
> cd frontend && npm run dev
> ```

### Lint

```bash
cd frontend && npm run lint
```

### Smoke test

```bash
python watchman/scripts/smoke_test.py                # full stack health check
python watchman/scripts/smoke_test.py --quick        # skip slow tests (nmap, dev server)
python watchman/scripts/smoke_test.py --backend-only # backend + containers only
python watchman/scripts/smoke_test.py --frontend-only # frontend only
```

### Utility Scripts

| Script | Purpose |
|---|---|
| `watchman/scripts/create_admin.py` | Create initial admin user |
| `watchman/scripts/container_manager.py` | Unified container lifecycle CLI |
| `watchman/scripts/smoke_test.py` | Full stack health check |
| `watchman/scripts/nmap_scan.py` | Network discovery scan |
| `watchman/scripts/collect_and_parse_snmp.py` | SNMP telemetry collection + metric aggregation |
| `watchman/scripts/parse_drift.py` | Parse drift output into reports |
| `watchman/scripts/seed_playbook_catalog.py` | Seed `catalog.json` into MongoDB |
| `watchman/scripts/cleanup_data.py` | Clean old playbook output data |

## Troubleshooting

| Problem | Solution |
|---|---|
| `podman: command not found` | Install Podman Desktop from https://podman.io |
| `podman-compose: command not found` | Run `pip install podman-compose` |
| `sentry-ansible image not found` | Run `python container_manager.py build ansible` |
| Playbook execution fails with `localhost` registry pull error | Run `python container_manager.py build all` to regenerate `sentry-ansible.tar` and bake it into watchman |
| White screen on `/ai-chat` | Rebuild the frontend container: `python container_manager.py build command-center` |
| Live syslog not showing in frontend dev | Ensure `podman-compose up syslog-ng` is running alongside the uvicorn backend |
| `npm run lint` crashes | Ensure `eslint-plugin-react` is in `devDependencies` (already fixed after health check) |
| `playbook not found` | Check the file exists in `watchman/playbooks/` |
| `MongoDB connection refused` | Ensure `MONGO_URI` in `watchman/.env` points at a running vault, or the compose override is active (see `AGENTS.md`) |
| `Login returns 401 Invalid credentials` | User may not exist in the vault. Create via the UI sign-up or `curl -X POST ... /users/` |
| `Short-name errors in build` | Podman 5.8.2+ needs fully-qualified names. Use `docker.io/library/...` in `FROM` lines |
| Playbook SSH connection fails | Verify credentials in `hosts.ini` and network reachability |
| AI chat returns errors | Set `HUGGINGFACE_API_KEY` in `.env` or via the UI |
| SELinux volume mount errors (Linux) | Ensure `:Z` flag is present on volume mounts in compose file |
| Permission denied running podman (Linux) | `sudo usermod -aG podman $USER` then log out and back in |
| `python` not found (Windows) | Install Python from python.org and check "Add Python to PATH" during install |
| Forward-slash paths fail (Windows CMD) | Use **PowerShell**, **Git Bash**, or **WSL** instead of Command Prompt |
| Podman Desktop VM not starting | Ensure WSL2 is installed and at least 2 GB RAM allocated to the VM (Podman Desktop Settings → Resources) |
| `podman-compose` fails with `:Z` flag errors | Already handled automatically by `container_manager.py` — run commands through it, not raw `podman` |
| Atlas sync skipped / no modal | `ATLAS_URI` unset or unreachable — the stack runs fully local with a warning. Fix `ATLAS_URI` in `.env` |

## Extending

### Add a Playbook

1. Write the `.yml` file in `watchman/playbooks/`
2. Add an entry in `watchman/playbooks/catalog.json` so it appears in the UI catalog (or run `seed_playbook_catalog.py`)
3. Optionally rebuild sentry-ansible if new package dependencies are needed

Example catalog entry:
```json
{
  "filename": "my_playbook.yml",
  "name": "My Playbook",
  "description": "What this playbook does",
  "tags": ["config", "cisco"],
  "target_devices": ["allHosts"],
  "destructive": false,
  "severity": "low"
}
```

### Add a Route

Routes live in `watchman/app/routes/`. Create a new file following the pattern of existing routers, then register it in `watchman/app/main.py`.

## Cross-Platform Notes

| Concern | Linux | Windows / macOS |
|---|---|---|
| SELinux `:Z`/`:z` flags | Required for bind mounts | Stripped automatically by `container_manager.py` |
| `--network=host` | Used for optimal container networking | Omitted (Podman VM networking) |
| Podman installation | `apt install podman` or `dnf install podman` | Install Podman Desktop |
| Path separators | `/` | `/` (handled by podman, not `\`) |
| Container runtime | Native podman | Podman managed via Podman Desktop VM |
| podman-compose | `pip install podman-compose` | Same |

## References

- [Atlas Sync](docs/ATLAS_SYNC.md) — Source-of-truth sync engine, merge model, and known limits
- [Auth Setup](docs/AUTH_SETUP.md) — Authentication and known auth gaps
- [Codebase Refactor](docs/CODEBASE_REFACTOR_2026-06-11.md) — Component extraction and deduplication
- [Container Management](docs/CONTAINER_MANAGEMENT.md) — Full container CLI reference
- [Migration Guide](docs/MIGRATION_GUIDE.md) — Moving from host Ansible to containerized
- [Health Check & Smoke Test](docs/HEALTH_CHECK.md) — Audit findings and smoke test usage
- [Config Drift Automation](docs/CONFIG_DRIFT_AUTOMATION.md) — Drift detection and git-style diff viewer
- [Network Baseline Automation](docs/NETWORK_BASELINES_AUTOMATION.md) — SNMP telemetry and baseline graph
- [Syslog Intelligence](docs/SYSLOG_INTELLIGENCE.md) — Log collection and AI analysis
- [Session Memory](docs/SESSION_MEMORY.md) — LLM chat persistence and context window
- [Real-Time Network Status](docs/REAL_TIME_NETWORK_STATUS.md) — Live device status with tier cascade
- [Security Hardening](docs/SECURITY_HARDENING.md) — Security posture and hardening notes
- [Host Vars Management](docs/HOST_VARS_MANAGEMENT.md) — Per-host variable handling
- [Playbook Modification](docs/PLAYBOOK_MODIFICATION.md) — Playbook catalog and severity guidance
- [Frontend Sync](docs/FRONTEND_SYNC.md) — Frontend sync integration
- [Session Log 2026-06-11](docs/SESSION_2026-06-11.md) — Bugfix session log (syslog, white screen, pull error)
- [AGENTS.md](AGENTS.md) — Developer quick-reference

### Companion repositories

- [Sentry-Labs-JR7](https://github.com/KDIAS-JR7/Sentry-Labs-JR7) — Chronological journal of the network-engineering side: building and testing the GNS3 fabric (19 days)
- [Ansible-JR7](https://github.com/KDIAS-JR7/Ansible-JR7) — The full Ansible playbook suite with blast-radius impact categorization
- [GNS3-Topology-JR7](https://github.com/KDIAS-JR7/GNS3-Topology-JR7) — Network architecture blueprint and topology files for the lab fabric
