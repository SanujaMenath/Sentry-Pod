#!/bin/bash
set -e

if ! podman images --format '{{.Repository}}' | grep -q '^localhost/sentry-ansible$'; then
    for tarfile in /tmp/sentry-ansible.tar /app/sentry-ansible.tar; do
        if [ -f "$tarfile" ]; then
            echo "Loading sentry-ansible image from $tarfile ..."
            podman load -i "$tarfile"
            break
        fi
    done
    if ! podman images --format '{{.Repository}}' | grep -q '^localhost/sentry-ansible$'; then
        echo "WARNING: sentry-ansible image not found; playbook execution will fail."
    fi
fi

exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --limit-concurrency 100
