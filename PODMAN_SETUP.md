# Podman Ansible Container Setup Guide

This guide explains how to set up and use the Podman container for running Ansible playbooks in Sentry-Pod on both Windows and Linux systems.

## Overview

Previously, the AI Chat Console relied on a host machine's local Ansible installation. This approach had several limitations:
- Different OS requirements (Windows vs Linux)
- Dependency conflicts between projects
- Difficulty sharing environments between developers

**Solution**: Use a containerized Ansible environment via Podman that works consistently on any system where Podman is installed.

## Prerequisites

### 1. Install Podman

**On Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install -y podman
```

**On Linux (Fedora/RHEL):**
```bash
sudo dnf install -y podman
```

**On macOS:**
```bash
brew install podman
```

**On Windows:**
Download and install from [podman.io](https://podman.io/docs/installation)

Verify installation:
```bash
podman --version
```

### 2. Navigate to the Sentry-Pod Repository
```bash
cd /path/to/Sentry-Pod
```

## Getting Started

### Step 1: Build the Ansible Container

This creates the `sentry-ansible` container image with all Ansible dependencies pre-installed.

**Using Python Manager (Recommended):**
```bash
python watchman/scripts/container_manager.py build
```

**Or using Podman directly:**
```bash
podman build -f watchman/Dockerfile.ansible -t sentry-ansible watchman/
```

The build process will:
- Install Ansible and Python dependencies
- Configure SSH for legacy network devices
- Install required Ansible collections (Cisco IOS)
- Set up the container for network automation

**Build Time**: ~2-5 minutes (depends on internet speed)

### Step 2: Verify the Setup

Check that everything is configured correctly:
```bash
python watchman/scripts/container_manager.py check
```

Expected output:
```
📊 Sentry-Pod Container Status
--------------------------------------------------
✅ Podman: podman version 4.x.x
✅ Container Image: 'sentry-ansible' exists
✅ Playbooks Directory: /.../watchman/playbooks (12 playbooks)
--------------------------------------------------
```

## Running Playbooks

### Using the Python Manager (Recommended)

**Run a specific playbook:**
```bash
python watchman/scripts/container_manager.py run get_facts.yml
```

**Run with custom inventory:**
```bash
python watchman/scripts/container_manager.py run get_facts.yml -i custom_hosts.ini
```

### Using Shell/Batch Scripts (Linux/macOS/Windows)

**On Linux/macOS:**
```bash
./watchman/scripts/run_playbook.sh get_facts.yml
```

**On Windows:**
```cmd
watchman\scripts\run_playbook.bat get_facts.yml
```

### Using Podman Directly

If you prefer to run Podman commands directly:

**Linux:**
```bash
PLAYBOOKS_DIR=$(cd watchman/playbooks && pwd)
podman run --rm -it \
  --network=host \
  -v "$PLAYBOOKS_DIR:/ansible:Z" \
  sentry-ansible \
  ansible-playbook get_facts.yml -i hosts.ini
```

**Windows (PowerShell):**
```powershell
$PLAYBOOKS_DIR = Resolve-Path "watchman\playbooks"
podman run --rm -it `
  -v "$PLAYBOOKS_DIR`:C:/ansible:Z" `
  sentry-ansible `
  ansible-playbook get_facts.yml -i hosts.ini
```

### Interactive Shell in Container

Access the container directly for debugging or manual Ansible runs:

```bash
python watchman/scripts/container_manager.py shell
```

Inside the container, you can:
```bash
cd /ansible
ls -la
ansible-playbook get_facts.yml -i hosts.ini
```

## AI Chat Console Integration

The AI Chat Console automatically uses the Podman container for playbook execution. When you trigger a playbook from the chat interface:

1. The chat backend detects your system (Windows/Linux)
2. Automatically builds and uses the Podman command
3. Streams playbook output back to the frontend in real-time
4. No manual container management needed

### Verifying Integration

1. Start the Sentry-Pod application
2. Navigate to **AI Chat Console**
3. Execute a quick action like "Discover network devices"
4. Monitor the playbook execution

The playbook should run inside the container without requiring any local Ansible installation.

## Troubleshooting

### Podman Not Found
**Error**: `podman: command not found`

**Solution**:
- Ensure Podman is installed: `podman --version`
- Add Podman to your system PATH
- On Windows, restart your terminal after installing Podman

### Container Image Not Found
**Error**: `Error: Image not found`

**Solution**:
```bash
# Rebuild the container
python watchman/scripts/container_manager.py build
```

### Permission Denied (Linux)
**Error**: `permission denied` when running podman

**Solution**:
```bash
# Add your user to the podman group (requires logout/login)
sudo usermod -aG podman $USER
# Or use sudo with podman commands
sudo podman run ...
```

### SELinux Issues (Linux)
If you see SELinux-related errors, the container is already configured to handle this with the `:Z` flag on volume mounts.

**If problems persist**:
```bash
# Check SELinux status
getenforce

# Temporarily set to permissive (requires reboot to revert)
sudo setenforce 0
```

### Ansible Connection Timeouts

If playbooks timeout connecting to devices:
1. Ensure devices are reachable from your network
2. Check firewall rules allow SSH/SNMP traffic
3. Try running with verbose output:
   ```bash
   podman run --rm -it \
     -v "$(pwd)/watchman/playbooks:/ansible:Z" \
     sentry-ansible \
     ansible-playbook get_facts.yml -i hosts.ini -vvv
   ```

### Host Key Verification Failed

If you see host key verification issues:
- The container has SSH configured for legacy network devices
- Check that your inventory file has correct device IPs/hostnames
- Verify device credentials are correct in your inventory

## Advanced Usage

### Custom Volume Mounts

To add additional volumes (e.g., for custom scripts):

```bash
podman run --rm -it \
  --network=host \
  -v "$PLAYBOOKS_DIR:/ansible:Z" \
  -v "./custom_scripts:/custom:Z" \
  sentry-ansible \
  bash
```

### Using Different Inventory Files

```bash
python watchman/scripts/container_manager.py run get_facts.yml -i production_hosts.ini
```

### Container Networking

- **Linux**: Uses `--network=host` for direct network access
- **Windows/macOS**: Uses default networking (some limitations with host network mode)

For Windows, if you need specific network configurations, use port mapping:

```bash
podman run --rm -it \
  -p 22:22 \
  -p 161:161/udp \
  -v "C:\path\to\playbooks:/ansible:Z" \
  sentry-ansible \
  bash
```

### Persisting Container Output

To keep container logs and outputs for debugging:

```bash
podman run --rm \
  -v "$PLAYBOOKS_DIR:/ansible:Z" \
  -v "./logs:/logs:Z" \
  sentry-ansible \
  ansible-playbook get_facts.yml -i hosts.ini 2>&1 | tee /logs/playbook.log
```

## Container Image Maintenance

### Rebuilding After Updates

If you update playbooks or requirements:

```bash
# Rebuild the container with a fresh base image
podman build --no-cache -f watchman/Dockerfile.ansible -t sentry-ansible watchman/
```

### Removing Old Images

```bash
# Remove the container image (frees disk space)
podman rmi sentry-ansible

# Remove unused images
podman image prune
```

### Updating Ansible Collections

To update installed Ansible collections:

```bash
podman run --rm -it \
  -v "$PLAYBOOKS_DIR:/ansible:Z" \
  sentry-ansible \
  ansible-galaxy collection install cisco.ios --upgrade
```

## Platform-Specific Notes

### Windows

- Use `podman machine` to manage the Podman VM:
  ```bash
  podman machine init
  podman machine start
  ```
- Volume paths use Windows-style paths but are mounted to Linux paths in the container
- Use `:Z` flag for SELinux compatibility (works on all platforms)

### macOS

- Similar to Linux for container management
- Use `podman machine` if running with Podman on macOS
- Network access from containers may need additional firewall rules

### Linux

- Full native Podman support
- `--network=host` provides optimal performance
- SELinux labels handled automatically with `:Z` flag

## Next Steps

1. **Build the container**: `python watchman/scripts/container_manager.py build`
2. **Test execution**: `python watchman/scripts/container_manager.py run get_facts.yml`
3. **Start Sentry-Pod**: `docker-compose up` (or `podman-compose up`)
4. **Use AI Chat Console**: Navigate to http://localhost:5173 and execute playbooks

## Contributing

When adding new playbooks:
1. Test them locally in the container:
   ```bash
   python watchman/scripts/container_manager.py run your_playbook.yml
   ```
2. Ensure they work without requiring system-specific Ansible installation
3. Document any new Ansible collections needed in `Dockerfile.ansible`

## References

- [Podman Documentation](https://podman.io/docs/)
- [Ansible Documentation](https://docs.ansible.com/)
- [Ansible Collections](https://docs.ansible.com/ansible/latest/collections/)
- [Container Volumes and Permissions](https://podman.io/docs/podman-run)
