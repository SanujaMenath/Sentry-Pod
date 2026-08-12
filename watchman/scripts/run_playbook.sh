#!/bin/bash
# Cross-platform Podman wrapper for running Ansible playbooks
# Works on Linux and macOS
# Usage: ./run_playbook.sh [playbook_name] [inventory_file]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WATCHMAN_DIR="$REPO_ROOT/watchman"
PLAYBOOKS_DIR="$WATCHMAN_DIR/playbooks"
CONTAINER_NAME="localhost/sentry-ansible"

# Get arguments
PLAYBOOK="${1:-collect_facts.yml}"
INVENTORY="${2:-hosts.ini}"

# Check if Podman is installed
if ! command -v podman &> /dev/null; then
    echo "❌ Error: Podman is not installed or not in PATH"
    echo "Install Podman from: https://podman.io/docs/installation"
    exit 1
fi

# Check if container exists
if ! podman image exists "$CONTAINER_NAME" 2>/dev/null; then
    echo "❌ Error: Container '$CONTAINER_NAME' does not exist"
    echo "Build it with: python scripts/container_manager.py build"
    exit 1
fi

# Check if playbook exists
if [ ! -f "$PLAYBOOKS_DIR/$PLAYBOOK" ]; then
    echo "❌ Error: Playbook '$PLAYBOOK' not found in $PLAYBOOKS_DIR"
    exit 1
fi

# Get absolute path
PLAYBOOKS_ABS="$(cd "$PLAYBOOKS_DIR" && pwd)"

# Run the playbook
echo "🚀 Running playbook '$PLAYBOOK' in container..."
exec podman run --rm -it \
    --network=host \
    -v "$PLAYBOOKS_ABS:/ansible:Z" \
    "$CONTAINER_NAME" \
    ansible-playbook "/ansible/$PLAYBOOK" -i "/ansible/$INVENTORY"
