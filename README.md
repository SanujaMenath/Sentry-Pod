# Sentry-Pod

Containerized Network Management System for Cisco-centric environments. Uses Intent-Based Networking with AI-powered natural language to Cisco IOS command translation, automated configuration drift detection, SNMP baseline monitoring, syslog intelligence, and Ansible playbook orchestration — all running in Podman containers.

## Key Features

- **AI-Powered IOS Translation** — Describe what you want in natural language; the LLM (HuggingFace Router) generates accurate Cisco IOS commands via the chat console
- **Config Drift Detection** — Ansible playbooks snapshot device running configs and diff them against golden baselines; results rendered as git-style diffs in the UI
- **SNMP Baseline Monitoring** — Collects and parses per-interface telemetry metrics with trend analysis
- **Syslog Intelligence** — Centralized syslog-ng listener with AI-augmented log analysis
- **Playbook Automation** — 40+ pre-built Ansible playbooks for Cisco device management (VLAN, OSPF, HSRP, NTP, CDP, SNMP, and more)
- **Session Memory** — LLM chat sessions persisted in MongoDB with context retention (last 10 messages)
- **Cross-Platform** — Runs on Linux (native podman) and Windows/macOS (Podman Desktop) with automatic SELinux handling

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
     │ └──────┬───────┘ │     │-v playbooks:/ansible│
     │        │         │     │ ansible-playbook    │
     │ ┌──────▼───────┐ │     └─────────────────────┘
     │ │ watchman     │ │
     │ │ (FastAPI)    │ │
     │ │ port 8000    │ │
     │ └──────┬───────┘ │
     │        │         │
     │ ┌──────▼───────┐ │
     │ │command-center│ │
     │ │ (React/nginx)│ │
     │ │ port 3000    │ │
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
│   │   ├── container_manager.py # Unified container CLI
│   │   ├── collect_snmp.py      # SNMP data collector
│   │   ├── parse_metrics.py     # Metric aggregation
│   │   ├── nmap_scan.py         # Network discovery
│   │   └── create_admin.py      # Admin user creation
│   ├── Dockerfile               # watchman container image
│   ├── Dockerfile.ansible       # sentry-ansible image
│   ├── Dockerfile.syslog-ng     # syslog-ng image
│   └── .env                     # Environment config
│
├── command-center/              # Production React UI (nginx)
├── frontend/                    # Dev-mode React UI
│
├── vault/                       # MongoDB data (empty, volume-mounted)
├── brain/                       # Placeholder (future AI agent)
├── deployments/                 # Placeholder
│
├── docs/                        # Feature documentation
│   ├── CONTAINER_MANAGEMENT.md
│   ├── CONFIG_DRIFT_AUTOMATION.md
│   ├── NETWORK_BASELINE_AUTOMATION.md
│   ├── REAL_TIME_NETWORK_STATUS.md
│   ├── SESSION_MEMORY.md
│   ├── SYSLOG_INTELLIGENCE.md
│   ├── MIGRATION_GUIDE.md
│   └── TEMPLATE.md
│
├── podman-compose.yaml          # Compose stack definition
├── requirements.txt             # Python dependencies
├── AGENTS.md                    # Developer reference
└── NetworkDevices.jsx           # Legacy component
```

## Prerequisites

- **Podman** — Install from [podman.io](https://podman.io). On Windows/macOS, install **Podman Desktop** (bundles the Podman CLI and manages a VM).
- **podman-compose** — `pip install podman-compose`
- **Python 3.11+** — For running `container_manager.py` on the host
- **Git** — To clone the repo

Verify:
```bash
podman --version
podman-compose --version
```

## Quick Start

```bash
# 1. Clone and enter the project
git clone <repo-url> && cd Sentry-Pod

# 2. Install podman-compose
pip install podman-compose

# 3. Build all container images (one-time, ~5-10 min)
python watchman/scripts/container_manager.py build all

# 4. Start the full stack
python watchman/scripts/container_manager.py up

# 5. Check everything is running
python watchman/scripts/container_manager.py status

# 6. Verify with a test playbook
python watchman/scripts/container_manager.py run get_facts.yml
```

The UI is available at **http://localhost:3000** (command-center) or **http://localhost:5173** (frontend dev mode).

## Services

| Service | Container | Tech | Port | Purpose |
|---|---|---|---|---|
| vault | `mongo:latest` | MongoDB | 27017 | Database (device data, users, sessions, syslog) |
| watchman | `sentry-pod_watchman` | FastAPI + Motor | 8000 | REST API backend |
| syslog-ng | `sentry-pod_syslog-ng` | syslog-ng | 10514/udp | Centralized syslog collection |
| command-center | `fresh-command-center` | React 19 + nginx | 3000 | Production UI |
| sentry-ansible | `sentry-ansible` | Ubuntu + Ansible | — | Ephemeral playbook runner |

## Usage

### CLI (container_manager.py)

```bash
# Build
python watchman/scripts/container_manager.py build all       # all images
python watchman/scripts/container_manager.py build watchman  # single service

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

Copy or edit `watchman/.env`:

```env
DB_USER=sentry_pod
DB_PASS=Admin123
DB_HOST=vault:27017
SECRET_KEY=<change-this-to-a-random-string>
HUGGINGFACE_API_KEY=<your-huggingface-token>    # Required for AI chat
```

The `HUGGINGFACE_API_KEY` can also be set via the UI's API key management page instead of the `.env` file.

## Development

### Backend (watchman)

```bash
cd watchman
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Requires MongoDB running (via `container_manager.py up` or local mongod).

### Frontend (dev mode)

```bash
cd frontend     # OR cd command-center
npm install
npm run dev     # Hot-reload at http://localhost:5173 (frontend) or :5174 (command-center)
```

### Lint

```bash
cd frontend && npm run lint
cd command-center && npm run lint
```

### Utility Scripts

| Script | Purpose |
|---|---|
| `watchman/scripts/create_admin.py` | Create initial admin user |
| `watchman/scripts/nmap_scan.py` | Network discovery scan |
| `watchman/scripts/collect_snmp.py` | SNMP telemetry collection |
| `watchman/scripts/parse_metrics.py` | Aggregate SNMP metrics |
| `watchman/scripts/cleanup_data.py` | Clean old playbook output data |

## Troubleshooting

| Problem | Solution |
|---|---|
| `podman: command not found` | Install Podman Desktop from https://podman.io |
| `podman-compose: command not found` | Run `pip install podman-compose` |
| `sentry-ansible image not found` | Run `python container_manager.py build ansible` |
| `playbook not found` | Check the file exists in `watchman/playbooks/` |
| `MongoDB connection refused` | Ensure vault is running (`container_manager.py status`) |
| Playbook SSH connection fails | Verify credentials in `hosts.ini` and network reachability |
| AI chat returns errors | Set `HUGGINGFACE_API_KEY` in `.env` or via the UI |
| SELinux volume mount errors (Linux) | Ensure `:Z` flag is present on volume mounts in compose file |
| Permission denied running podman (Linux) | `sudo usermod -aG podman $USER` then log out and back in |

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

- [Container Management](docs/CONTAINER_MANAGEMENT.md) — Full container CLI reference
- [Migration Guide](docs/MIGRATION_GUIDE.md) — Moving from host Ansible to containerized
- [Config Drift Automation](docs/CONFIG_DRIFT_AUTOMATION.md) — Drift detection deep-dive
- [Network Baseline Automation](docs/NETWORK_BASELINE_AUTOMATION.md) — SNMP telemetry
- [Syslog Intelligence](docs/SYSLOG_INTELLIGENCE.md) — Log collection and AI analysis
- [Session Memory](docs/SESSION_MEMORY.md) — LLM chat persistence
- [Real-Time Network Status](docs/REAL_TIME_NETWORK_STATUS.md) — Live device status
- [AGENTS.md](AGENTS.md) — Developer quick-reference
- [Podman Setup Guide](PODMAN_SETUP.md) — Detailed Podman installation instructions
