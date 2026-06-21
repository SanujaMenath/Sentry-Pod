#!/bin/bash
set -e

# Clean stale Podman storage after host reboot
if podman info 2>&1 | grep -q "boot ID differs"; then
    echo "Cleaning stale Podman storage after host reboot ..."
    rm -rf /run/containers/storage /run/libpod
fi

podman images --format '{{.Repository}}' | grep -q '^localhost/sentry-ansible$' && FOUND=1 || FOUND=0

if [ "$FOUND" = "0" ]; then
    for tarfile in /tmp/sentry-ansible.tar /app/sentry-ansible.tar; do
        if [ -f "$tarfile" ]; then
            echo "Loading sentry-ansible image from $tarfile ..."
            podman load -i "$tarfile" || true
            break
        fi
    done
    podman images --format '{{.Repository}}' | grep -q '^localhost/sentry-ansible$' && FOUND=1 || FOUND=0
    if [ "$FOUND" = "0" ]; then
        echo "WARNING: sentry-ansible image not found; playbook execution will fail."
    fi
fi

exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --limit-concurrency 100
