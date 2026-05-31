# Migration Guide: From Host Ansible to Podman Container

This guide explains how to migrate from using your host's Ansible installation to using the new containerized approach in Sentry-Pod.

## What Changed?

### Before (Old Setup)
- Ansible installed directly on your host machine
- Playbooks executed via `ansible-playbook` command
- Different setup required for Windows vs Linux
- Potential conflicts with other projects

### After (New Setup) ✨
- Ansible runs inside a Podman container (`sentry-ansible`)
- Same setup works on Windows, Linux, and macOS
- Isolated environment - no host dependency
- Easier for team collaboration

## Migration Steps

### Step 1: Install Podman (One-time Setup)

If you don't already have Podman installed:

**Linux:**
```bash
sudo apt update && sudo apt install -y podman  # Ubuntu/Debian
# OR
sudo dnf install -y podman  # Fedora/RHEL
```

**macOS:**
```bash
brew install podman
```

**Windows:**
1. Download installer from https://podman.io/docs/installation
2. Run the installer
3. Follow the setup wizard

**Verify:**
```bash
podman --version  # Should output podman version X.X.X
```

### Step 2: Build the Container

```bash
cd /path/to/Sentry-Pod
python watchman/scripts/container_manager.py build
```

This creates the `sentry-ansible` container image with all necessary Ansible tools.

**Build Time**: ~2-5 minutes (one-time only)

### Step 3: Verify Everything Works

```bash
python watchman/scripts/container_manager.py check
```

You should see:
```
📊 Sentry-Pod Container Status
--------------------------------------------------
✅ Podman: podman version X.X.X
✅ Container Image: 'sentry-ansible' exists
✅ Playbooks Directory: /path/to/watchman/playbooks (20 playbooks)
--------------------------------------------------
```

### Step 4: Test Playbook Execution

Run a test playbook:
```bash
python watchman/scripts/container_manager.py run get_facts.yml
```

You should see Ansible output streaming to your terminal.

## What Happens Internally

### Code Changes

The playbook execution is now handled by `watchman/app/services/playbook_service.py`:

**Before:**
```python
# Direct host Ansible execution
subprocess.run(['ansible-playbook', 'get_facts.yml', '-i', 'hosts.ini'])
```

**After:**
```python
# Podman container execution
cmd = get_podman_command('get_facts.yml')
subprocess.run(cmd)
# Which generates:
# podman run --rm -it --network=host \
#   -v /path/to/playbooks:/ansible:Z \
#   sentry-ansible \
#   ansible-playbook /ansible/get_facts.yml -i /ansible/hosts.ini
```

### Automatic Platform Detection

The backend automatically detects your OS and adjusts the command:
- **Linux**: Uses `--network=host` for optimal performance
- **Windows**: Uses default networking (some Podman limitations)
- **macOS**: Uses default networking

## Using the AI Chat Console

No changes needed! The AI Chat Console works the same way:

1. Navigate to http://localhost:5173
2. Go to **AI Chat Console**
3. Execute a playbook or action
4. Watch it run inside the container

Behind the scenes, the Podman container handles execution automatically.

## Manual Playbook Execution

### Using Python Manager

```bash
# Run a specific playbook
python watchman/scripts/container_manager.py run get_facts.yml

# Run with custom inventory
python watchman/scripts/container_manager.py run get_facts.yml -i production_hosts.ini

# Open interactive shell
python watchman/scripts/container_manager.py shell
```

### Using Shell/Batch Scripts

**Linux/macOS:**
```bash
./watchman/scripts/run_playbook.sh get_facts.yml
```

**Windows:**
```cmd
watchman\scripts\run_playbook.bat get_facts.yml
```

### Using Podman Directly

If you prefer Podman commands:

**Linux:**
```bash
PLAYBOOKS_DIR=$(cd watchman/playbooks && pwd)
podman run --rm -it \
  --network=host \
  -v "$PLAYBOOKS_DIR:/ansible:Z" \
  sentry-ansible \
  ansible-playbook /ansible/get_facts.yml -i /ansible/hosts.ini
```

**Windows (PowerShell):**
```powershell
$PLAYBOOKS_DIR = Resolve-Path "watchman\playbooks"
podman run --rm -it `
  -v "$PLAYBOOKS_DIR`:C:/ansible:Z" `
  sentry-ansible `
  ansible-playbook /ansible/get_facts.yml -i /ansible/hosts.ini
```

## Removing Old Ansible Installation (Optional)

If you want to clean up the host system after verifying everything works:

**Linux:**
```bash
# Keep Ansible installed for other projects, or:
sudo apt remove ansible  # Ubuntu/Debian
sudo dnf remove ansible  # Fedora/RHEL
```

**macOS:**
```bash
brew uninstall ansible
```

**Windows:**
- Control Panel → Programs → Uninstall a program
- Find Ansible and remove it

**Note**: Only remove if you're sure no other projects depend on it!

## Troubleshooting the Migration

### Issue: "Command 'podman' not found"
**Solution**: 
- Install Podman (see Step 1)
- Restart your terminal after installation
- On Windows, add Podman to PATH if needed

### Issue: "Container 'sentry-ansible' not found"
**Solution**:
```bash
python watchman/scripts/container_manager.py build
```

### Issue: "Permission denied" running Podman (Linux)
**Solution**:
```bash
# Add yourself to podman group
sudo usermod -aG podman $USER

# Log out and log back in, or:
newgrp podman

# Verify
podman ps
```

### Issue: Old playbooks aren't working
**Reason**: Playbooks may reference host-specific paths or Ansible configurations

**Solution**:
1. Test inside the container first:
   ```bash
   python watchman/scripts/container_manager.py shell
   cd /ansible
   ansible-playbook your_playbook.yml -i hosts.ini -vvv
   ```
2. Fix any issues (usually path-related)
3. Test again

### Issue: Network connectivity issues from container
**Solution**:
- On Linux: Already using `--network=host`
- On Windows/macOS: May need to adjust firewall rules
- Test with: `podman run -it sentry-ansible ping 8.8.8.8`

## Rollback (If Needed)

If you need to revert to the old setup temporarily:

1. **Uninstall/disable Podman** (optional)
2. **Install Ansible** on host:
   ```bash
   pip install ansible
   ansible-galaxy collection install cisco.ios
   ```
3. **Revert the code changes**:
   - Restore `watchman/app/services/playbook_service.py` from git history
   - Remove Podman-related files

However, we recommend staying with the containerized approach for consistency!

## FAQ

**Q: Does this affect my existing playbooks?**
A: No! All existing playbooks work as-is. The execution environment is now just containerized.

**Q: What about SSH keys and credentials?**
A: They're the same - mounted from your host via volume mounts. No changes needed.

**Q: Can I use this on Windows and Linux in the same team?**
A: Yes! That's the whole point. Everyone gets the same Ansible version and configuration.

**Q: What about performance?**
A: Negligible difference. Podman overhead is minimal (~100-300ms per run).

**Q: Do I need Docker instead of Podman?**
A: Podman is preferred (simpler, no daemon), but this could be adapted for Docker if needed.

**Q: Can I customize the container?**
A: Yes! Edit `watchman/Dockerfile.ansible` and rebuild:
   ```bash
   podman build -f watchman/Dockerfile.ansible -t sentry-ansible watchman/
   ```

**Q: What if my organization only uses Windows?**
A: Install Podman on Windows following the official guide. Everything works the same way.

## Next Steps

1. ✅ Install Podman
2. ✅ Build the container
3. ✅ Test a playbook
4. ✅ Start Sentry-Pod and test the AI Chat Console
5. ✅ Share with your team
6. ✅ Profit! 🎉

## Support

For issues:
1. Check the [Complete Setup Guide](../PODMAN_SETUP.md)
2. Run `python watchman/scripts/container_manager.py check`
3. Enable verbose logging: `ansible-playbook -vvv`
4. Check Podman logs: `podman logs <container_id>`

## References

- [Watchman README](README.md)
- [Complete Podman Setup Guide](../PODMAN_SETUP.md)
- [Podman Docs](https://podman.io/docs/)
- [Ansible Docs](https://docs.ansible.com/)
