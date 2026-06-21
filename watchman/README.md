# Watchman - Sentry-Pod Ansible Automation Engine

Watchman is the backend automation engine that powers Sentry-Pod's AI-driven network management capabilities. It handles playbook execution, audit logging, device inventory management, and AI-powered network operations.

## Quick Start with Podman (Cross-Platform)

### Prerequisites
- **Podman** (works on Windows, Linux, macOS)
- **Python 3.8+**
- **Git**

### 1. Install Podman

**Linux (Ubuntu/Debian):**
```bash
sudo apt update && sudo apt install -y podman
```

**Linux (Fedora/RHEL):**
```bash
sudo dnf install -y podman
```

**macOS:**
```bash
brew install podman
```

**Windows:**
Download from [podman.io](https://podman.io/docs/installation)

### 2. Build the Ansible Container

```bash
cd /path/to/Sentry-Pod
python watchman/scripts/container_manager.py build
```

Verify setup:
```bash
python watchman/scripts/container_manager.py check
```

### 3. Run Playbooks

**Quick example:**
```bash
python watchman/scripts/container_manager.py run get_facts.yml
```

**Or use the shell script (Linux/macOS):**
```bash
./watchman/scripts/run_playbook.sh get_facts.yml
```

**Or batch file (Windows):**
```cmd
watchman\scripts\run_playbook.bat get_facts.yml
```

## Architecture

```
Watchman (Backend)
├── app/
│   ├── routes/              # FastAPI endpoints
│   │   ├── playbook_routes.py
│   │   ├── llm_routes.py
│   │   ├── auth_routes.py
│   │   ├── user_routes.py
│   │   ├── network_routes.py
│   │   ├── audit_routes.py
│   │   ├── syslog_routes.py
│   │   ├── topology_routes.py
│   │   ├── console_routes.py
│   │   └── setup_routes.py
│   ├── services/            # Business logic
│   │   ├── playbook_service.py    # Podman integration
│   │   ├── auth_service.py
│   │   ├── user_service.py
│   │   ├── topology_service.py
│   │   └── setup_service.py
│   ├── models/              # Pydantic models
│   ├── core/                # Config, security, dependencies
│   └── database.py          # MongoDB (motor) connection
├── playbooks/               # Ansible playbooks
│   ├── get_facts.yml
│   ├── catalog.json
│   └── hosts.ini
├── scripts/
│   ├── container_manager.py  # 🐳 Main container CLI
│   ├── run_playbook.sh       # Linux/macOS wrapper
│   ├── run_playbook.bat      # Windows wrapper
│   └── ...
├── Dockerfile               # FastAPI backend container
├── Dockerfile.ansible       # Ansible runtime container
└── main.py                  # Application entry point
```

## Key Components

### 1. Podman Container Integration

**File**: `watchman/app/services/playbook_service.py`

The playbook service executes Ansible playbooks inside a Podman container instead of relying on host-installed Ansible:

```python
def get_podman_command(playbook_name: str) -> List[str]:
    """Build cross-platform Podman command for running Ansible"""
    # Returns platform-aware command that works on Windows and Linux
```

**Benefits**:
- ✅ No dependency on host Ansible installation
- ✅ Consistent environment across Windows/Linux/macOS
- ✅ Isolated from system libraries
- ✅ Easy version management
- ✅ Safe for multi-user systems

### 2. Container Manager CLI

**File**: `watchman/scripts/container_manager.py`

Python-based CLI for managing the container lifecycle:

```bash
# Build the container
python container_manager.py build

# Check status
python container_manager.py check

# Run a playbook
python container_manager.py run get_facts.yml

# Open interactive shell
python container_manager.py shell
```

### 3. Platform-Specific Wrappers

**Linux/macOS**: `watchman/scripts/run_playbook.sh`
**Windows**: `watchman/scripts/run_playbook.bat`

These scripts automatically detect paths and invoke the container.

## How Playbook Execution Works

### Flow Diagram

```
AI Chat Console (Frontend)
        ↓
Chat Request (http://localhost:8000/playbooks/execute-stream/{playbook})
        ↓
FastAPI Backend (playbook_routes.py)
        ↓
playbook_service.run_playbook_stream_generator()
        ↓
get_podman_command() → Builds container command
        ↓
subprocess.Popen() → Launches Podman container
        ↓
Podman Container
  ├─ Mount: ./watchman/playbooks → /ansible
  ├─ Run: ansible-playbook /ansible/{playbook} -i /ansible/hosts.ini
  └─ Stream output via Server-Sent Events
        ↓
Real-time output streamed to Frontend
        ↓
User sees live playbook execution
```

### On Linux:
```bash
podman run --rm -it \
  --network=host \                    # ← Direct network access
  -v ./watchman/playbooks:/ansible:Z \
  sentry-ansible \
  ansible-playbook get_facts.yml -i hosts.ini
```

### On Windows:
```bash
podman run --rm -it \
  -v C:\path\to\playbooks:/ansible:Z \  # ← Windows paths handled automatically
  sentry-ansible \
  ansible-playbook get_facts.yml -i hosts.ini
```

## Dockerfile Configuration

**File**: `watchman/Dockerfile.ansible`

The container is pre-configured with:
- ✅ Ansible 2.10+
- ✅ Python 3 + paramiko (for legacy SSH algorithms)
- ✅ SSH client with legacy cipher support
- ✅ Cisco IOS collection
- ✅ Network automation tools

## Inventory Management

**File**: `watchman/playbooks/hosts.ini`

Example inventory:
```ini
[allHosts]
R1 ansible_host=192.168.1.10
R2 ansible_host=192.168.1.11
ESW1 ansible_host=192.168.1.20

[allHosts:vars]
ansible_user=admin
ansible_password=password123
ansible_connection=network_cli
ansible_network_os=ios
```

## Environment Variables

Create `.env` in the watchman directory:

```env
# MongoDB
MONGO_URI="mongodb://user:pass@host:27017/sentry_pod_db?authSource=admin"
# or individual fields:
DB_USER=<user>
DB_PASS=<pass>
DB_HOST=<host>

# JWT
SECRET_KEY=<change-this-to-a-random-string>

# Hugging Face API (required for AI chat)
HUGGINGFACE_API_KEY=your_api_key_here
```

## Running the Backend

### Development Mode

```bash
cd watchman
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Production (Podman Compose)

```bash
# Inside the Sentry-Pod root
podman-compose up watchman
```

## API Endpoints

### Playbook Execution

**Streaming Endpoint** (Real-time output):
```
GET /playbooks/execute-stream/{playbook_name}
```

Response: Server-Sent Events (SSE)
```json
{"type": "output", "line": "PLAY [Example] ****"}
{"type": "complete", "status": "success", "returncode": 0}
```

**Standard Endpoint**:
```
POST /playbooks/execute
```

Body:
```json
{
  "name": "get_facts.yml"
}
```

### Other Endpoints

- `GET /playbooks/list` - List all playbooks
- `GET /playbooks/catalog` - Get playbook metadata
- `POST /playbooks/suggest` - Get AI suggestions
- `GET /playbooks/inventory/all-hosts-count` - Get device count
- `GET /api/network/drift/reports` - Get configuration drift reports
- `GET /api/network/devices` - List network devices

## Database Schema

MongoDB (via motor async driver) stores:
- Users and roles
- Network device inventory
- Configuration snapshots and golden baselines
- Drift reports and diffs
- LLM chat sessions (conversations collection)
- Audit logs (user actions, timestamps)
- API keys

## Troubleshooting

### Issue: "Podman not found"
**Solution**:
```bash
# Verify Podman is installed
podman --version

# Add to PATH if needed (Windows)
setx PATH "%PATH%;C:\Program Files\Podman"
```

### Issue: SELinux permission denied (Linux)
**Solution**:
```bash
# The :Z flag in volume mounts should handle this, but if not:
sudo semanage fcontext -a -t container_file_t "$(pwd)/watchman/playbooks(/.*)?"
```

### Issue: Playbook timeouts
**Solution**: Extend timeout in `playbook_service.py`:
```python
timeout=300  # Increase from 300 seconds
```

### Issue: Container won't build
**Solution**:
```bash
# Rebuild with no cache
podman build --no-cache -f watchman/Dockerfile.ansible -t sentry-ansible watchman/

# Or check Podman version
podman version
```

## Contributing

When adding new playbooks:

1. **Create the playbook** in `watchman/playbooks/`
2. **Test it locally** inside the container:
   ```bash
   python scripts/container_manager.py run your_playbook.yml
   ```
3. **Update catalog** in `watchman/playbooks/catalog.json`
4. **Document in comments** with tags and target devices

Example playbook header:
```yaml
---
# Catalog Metadata:
# name: Get Facts from Devices
# description: Collect device facts via Cisco IOS
# tags: [discovery, facts, ios]
# target_devices: [all]
# destructive: false
# severity: low

- name: Gather network facts
  hosts: allHosts
  gather_facts: no
  tasks:
    # Your tasks here
```

## Platform Support Matrix

| Feature | Linux | macOS | Windows |
|---------|-------|-------|---------|
| Podman | ✅ Native | ✅ VM | ✅ Desktop |
| Container Build | ✅ | ✅ | ✅ |
| Playbook Execution | ✅ | ✅ | ✅ |
| --network=host | ✅ | ⚠️ Limited | ⚠️ Limited |
| Volume Mounts | ✅ | ✅ | ✅ |
| Shell Access | ✅ | ✅ | ✅ |

## Performance Notes

- **First Run**: Container image build takes 2-5 minutes
- **Subsequent Runs**: <1 second startup overhead
- **Network Queries**: Limited by device response times, not Podman
- **Memory**: ~150MB per running playbook
- **CPU**: Single-threaded by default, use Ansible `forks` for parallelization

## Security Considerations

- Credentials stored in `hosts.ini` (consider Vault integration)
- Container runs with `--rm` flag (no persistent state)
- SELinux labels (`Z` flag) ensure proper isolation
- SSH private keys can be mounted via `-v ~/.ssh:/root/.ssh:Z`

## Future Enhancements

- [ ] Ansible Vault integration in container
- [ ] Container registry push/pull
- [ ] Kubernetes deployment support
- [ ] GPU support for ML models
- [ ] Multi-container Podman Pod for services
- [ ] Rootless Podman setup guide

## References

- [Podman Documentation](https://podman.io/docs/)
- [Ansible Best Practices](https://docs.ansible.com/ansible/latest/tips_tricks/ansible_tips_tricks.html)
- [Cisco IOS Collection](https://github.com/ansible-collections/cisco.ios)
