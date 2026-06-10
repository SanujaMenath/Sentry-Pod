#!/bin/bash
set -e

if ! podman images --format '{{.Repository}}' | grep -q '^localhost/sentry-ansible$'; then
    if [ -f /tmp/sentry-ansible.tar ]; then
        echo "Loading sentry-ansible image..."
        podman load -i /tmp/sentry-ansible.tar
    else
        echo "WARNING: sentry-ansible image not found; playbook execution will fail."
    fi
fi

exec uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
