# Sentry-Pod

Containerized Network Management System for Cisco-centric environments. Uses Intent-Based Networking with AI-powered natural language to Cisco IOS command translation, automated configuration drift detection, SNMP baseline monitoring, syslog intelligence, and Ansible playbook orchestration — all running in Podman containers. The platform is built and tested against a real GNS3-simulated Cisco fabric that is provisioned end-to-end via Ansible Infrastructure-as-Code.

## Key Features

- **AI-Powered IOS Translation** — Describe what you want in natural language; the LLM (HuggingFace Router) generates accurate Cisco IOS commands via the chat console
- **Config Drift Detection** — Ansible playbooks snapshot device running configs and diff them against golden baselines; results rendered as git-style diffs in the UI
- **SNMP Baseline Monitoring** — Collects and parses per-interface telemetry metrics with trend analysis
- **Syslog Intelligence** — Centralized syslog-ng listener with AI-augmented log analysis
- **Playbook Automation** — 40+ pre-built Ansible playbooks for Cisco device management (VLAN, OSPF, HSRP, NTP, CDP, SNMP, and more)
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

**18 production-style playbooks** replace manual CLI screen-scraping with structured, repeatable IaC, each tagged by blast-radius impact (Low / Medium / High / Critical):

| Area | Playbooks |
|---|---|
| Routing & HA | `ospf.yml`, `VlanHSRP.yml`, `HSRP_active.yml`, `defaultGateway.yml` |
| Layer 2 | `vlans.yml`, `VLANDist.yml`, `endDevice.yml`, `cdp.yml`, `enableCDP.yml` |
| Telemetry & hardening | `snmp.yml`, `NTP.yml`, `NTP_edge.yml`, `LocalTime.yml`, `syslog.yml` |
| Change management | `write.yml` (pre-backup + NVRAM), `goldenState.yml`, `get_facts.yml`, `showCommand.yml` |

All 16 devices are configured with a single command; drift detection snapshots running configs against golden baselines. Full playbook reference with impact categories: [Ansible-JR7](https://github.com/KDIAS-JR7/Ansible-JR7)

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
     │ │ (standalone) │ │     │-v playbooks:/ansible│
     │ └──────────────┘ │     │ ansible-playbook    │
     │                  │     └─────────────────────┘
     │ ┌──────────────┐ │
     │ │ watchman     │──────┐
     │ │ (FastAPI)    │ │    │
     │ │ port 8000    │ │    │
     │ └──────┬───────┘ │    │
     │        │         │    │
     │ ┌──────▼───────┐ │    │
     │ │command-center│ │    │
     │ │ (React/nginx)│ │    │
     │ │ port 3000    │ │    │
     │ └──────────────┘ │    │
     │                  │    │
     │ ┌──────────────┐ │    │
     │ │ syslog-ng    │ │    │
     │ │ UDP 10514    │ │    │
     │ └──────────────┘ │    │
     └──────────────────┘    │
                             │
               ┌─────────────▼──────────────┐
               │   MongoDB Atlas (cloud)    │
               │   sentrypod.n5boezy.net    │
               │   users, devices, sessions │
               └────────────────────────────┘
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
│   │   ├── main.py              # App entry point
│   │   ├── database.py          # MongoDB connection (motor)
│   │   ├── core/                # Config, security, dependencies
│   │   ├── models/              # Pydantic/MongoDB models
│   │   ├── routes/              # API route handlers
│   │   └── services/            # Business logic (playbooks, auth)
│   ├── playbooks/               # Ansible playbooks + data
│   │   ├── hosts.ini            # Device inventory
│   │   ├── catalog.json         # Playbook catalog for UI
│   │   ├── configDrift/         # Drift detection outputs
│   │   ├── goldenState/         # Golden baseline configs
│   │   ├── runningConfigs/      # Collected running configs
│   │   ├── syslog/              # Per-device syslog data
│   │   └── snmp_output/         # SNMP telemetry metrics
│   ├── scripts/
│   │   ├── container_manager.py     # Unified container CLI
│   │   ├── collect_and_parse_snmp.py# SNMP collect + parse
│   │   ├── nmap_scan.py             # Network discovery
│   │   ├── create_admin.py          # Admin user creation
│   │   ├── smoke_test.py            # Full stack health check
│   │   └── sync_users.py            # Atlas → local vault sync
│   ├── playbooks/
│   │   └── run_action.sh            # Parametrized action runner
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
├── vault/                       # MongoDB data (empty, volume-mounted)
│
├── docs/                        # Feature documentation
│   ├── AUTH_SETUP.md
│   ├── CODEBASE_REFACTOR_2026-06-11.md
│   ├── CONFIG_DRIFT_AUTOMATION.md
│   ├── CONTAINER_MANAGEMENT.md
│   ├── HEALTH_CHECK.md
│   ├── IMPLEMENTATION_SUMMARY.md
│   ├── MIGRATION_GUIDE.md
│   ├── NETWORK_BASELINE_AUTOMATION.md
│   ├── REAL_TIME_NETWORK_STATUS.md
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
git clone <repo-url> && cd Sentry-Pod

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
>
> See [Configuration](#configuration) and [SSH / Credential Setup](#ssh--credential-setup) below.

## Services

| Service | Container | Tech | Port | Purpose |
|---|---|---|---|---|
| vault | `mongo:latest` | MongoDB | 27017 | Local MongoDB (standalone — unused by default) |
| watchman | `sentry-pod_watchman` | FastAPI + Motor | 8000 | REST API backend (connects to Atlas) |
| syslog-ng | `sentry-pod_syslog-ng` | syslog-ng | 10514/udp | Centralized syslog collection |
| command-center | `fresh-command-center` | React 19 + nginx | 3000 | Production UI |
| sentry-ansible | `sentry-ansible` | Ubuntu + Ansible | — | Ephemeral playbook runner (`--pull=never`, image loaded from tar) |

## Usage

### CLI (container_manager.py)

```bash
# Build
python watchman/scripts/container_manager.py build all             # all images
python watchman/scripts/container_manager.py build watchman        # single service
python watchman/scripts/container_manager.py build command-center  # frontend UI only

# Stack lifecycle
python watchman/scripts/container_manager.py up     # start all services
python watchman/scripts/container_manager.py down   # stop all services
python watchman/scripts/container_manager.py status # system status

# Ansible playbooks
python watchman/scripts/container_manager.py run get_facts.yml
python watchman/scripts/container_manager.py run configDrift.yml -i hosts.ini
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
  -d '{"name": "get_facts.yml"}'

# Streaming execution (SSE)
curl http://localhost:8000/playbooks/execute-stream/get_facts.yml \
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
```

## Authentication

Login is handled via JWT. The watchman container connects to **MongoDB Atlas** by default (credentials in `watchman/.env`). A local `vault` MongoDB container is defined in the compose file but unused unless you revert (see `AGENTS.md`).

### Default credentials

After first-time sign-up via the UI, an admin must promote the user to `"Super Admin"`
for full access. See [Auth Setup](docs/AUTH_SETUP.md#usage) for CLI commands.

### Known auth gaps

Some frontend service files and pages use raw `fetch()` or separate axios instances with
hardcoded `http://localhost:8000` URLs — they **do not send the JWT Bearer token**.
See [Auth Setup](docs/AUTH_SETUP.md#known-auth-gaps-not-yet-fixed) for the full list.

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
# MongoDB Atlas (default — watchman connects via load_dotenv())
MONGO_URI="mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/sentry_pod_db"

# ... or use individual fields (pydantic constructs the URI):
DB_USER=<user>
DB_PASS=<pass>
DB_HOST=<cluster>.mongodb.net

# JWT
SECRET_KEY=<change-this-to-a-random-string>

# Required for AI chat
HUGGINGFACE_API_KEY=<your-huggingface-token>
```

The `HUGGINGFACE_API_KEY` can also be set via the UI's API key management page instead of the `.env` file.

**Switching to local vault:** See [Auth Setup](docs/AUTH_SETUP.md#reverting-to-local-vault-auth) or `AGENTS.md`.

## Development

### Backend (watchman)

```bash
cd watchman
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Requires MongoDB accessible (Atlas by default; or run vault locally and switch auth — see `AGENTS.md`).

> For live syslog data, also run the syslog-ng container alongside uvicorn:
> ```bash
> podman-compose up syslog-ng
> ```

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

### Utility Scripts

| Script | Purpose |
|---|---|
| `watchman/scripts/create_admin.py` | Create initial admin user |
| `watchman/scripts/sync_users.py` | Sync users from Atlas to local vault MongoDB |
| `watchman/scripts/nmap_scan.py` | Network discovery scan |
| `watchman/scripts/collect_and_parse_snmp.py` | SNMP telemetry collection + metric aggregation |
| `watchman/scripts/smoke_test.py` | Full stack health check |
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
| `MongoDB connection refused` | Ensure Atlas credentials in `watchman/.env` are correct, or run vault locally and switch auth (see `AGENTS.md`) |
| `Login returns 401 Invalid credentials` | User may not exist in Atlas. Create via the UI sign-up or `curl -X POST ... /users/` |
| `Short-name errors in build` | Podman 5.8.2+ needs fully-qualified names. Use `docker.io/library/...` in `FROM` lines |
| Playbook SSH connection fails | Verify credentials in `hosts.ini` and network reachability |
| AI chat returns errors | Set `HUGGINGFACE_API_KEY` in `.env` or via the UI |
| SELinux volume mount errors (Linux) | Ensure `:Z` flag is present on volume mounts in compose file |
| Permission denied running podman (Linux) | `sudo usermod -aG podman $USER` then log out and back in |
| `python` not found (Windows) | Install Python from python.org and check "Add Python to PATH" during install |
| Forward-slash paths fail (Windows CMD) | Use **PowerShell**, **Git Bash**, or **WSL** instead of Command Prompt |
| Podman Desktop VM not starting | Ensure WSL2 is installed and at least 2 GB RAM allocated to the VM (Podman Desktop Settings → Resources) |
| `podman-compose` fails with `:Z` flag errors | Already handled automatically by `container_manager.py` — run commands through it, not raw `podman` |

## Extending

### Add a Playbook

1. Write the `.yml` file in `watchman/playbooks/`
2. Add an entry in `watchman/playbooks/catalog.json` so it appears in the UI catalog
3. Optionally rebuild sentry-ansible if new package dependencies are needed

Example catalog entry:
```json
{
  "name": "my_playbook.yml",
  "description": "What this playbook does",
  "category": "configuration"
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

- [Auth Setup](docs/AUTH_SETUP.md) — Authentication, build fixes, and known auth gaps
- [Codebase Refactor](docs/CODEBASE_REFACTOR_2026-06-11.md) — Component extraction and deduplication
- [Container Management](docs/CONTAINER_MANAGEMENT.md) — Full container CLI reference
- [Migration Guide](docs/MIGRATION_GUIDE.md) — Moving from host Ansible to containerized
- [Health Check & Smoke Test](docs/HEALTH_CHECK.md) — Audit findings and smoke test usage
- [Config Drift Automation](docs/CONFIG_DRIFT_AUTOMATION.md) — Drift detection and git-style diff viewer
- [Network Baseline Automation](docs/NETWORK_BASELINE_AUTOMATION.md) — SNMP telemetry and baseline graph
- [Syslog Intelligence](docs/SYSLOG_INTELLIGENCE.md) — Log collection and AI analysis
- [Session Memory](docs/SESSION_MEMORY.md) — LLM chat persistence and context window
- [Real-Time Network Status](docs/REAL_TIME_NETWORK_STATUS.md) — Live device status with tier cascade
- [Implementation Summary](docs/IMPLEMENTATION_SUMMARY.md) — Configuration drift diff viewer details
- [Session Log 2026-06-11](docs/SESSION_2026-06-11.md) — Bugfix session log (syslog, white screen, pull error)
- [AGENTS.md](AGENTS.md) — Developer quick-reference with hardcoded URL todo list

### Companion repositories

- [Sentry-Labs-JR7](https://github.com/KDIAS-JR7/Sentry-Labs-JR7) — Chronological journal of the network-engineering side: building and testing the GNS3 fabric (19 days)
- [Ansible-JR7](https://github.com/KDIAS-JR7/Ansible-JR7) — The full Ansible playbook suite with blast-radius impact categorization
- [GNS3-Topology-JR7](https://github.com/KDIAS-JR7/GNS3-Topology-JR7) — Network architecture blueprint and topology files for the lab fabric
