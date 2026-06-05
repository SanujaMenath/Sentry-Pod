#!/usr/bin/env python3
"""Cleanup watchman/data by removing old/empty per-host JSON files.

Removes files where the top-level 'interfaces' key is empty or missing.
Backs up removed files to watchman/data/backup/ with a timestamped suffix.
"""
import json
import os
from datetime import datetime

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
BACKUP_DIR = os.path.join(DATA_DIR, 'backup')

def ensure_dirs():
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(BACKUP_DIR, exist_ok=True)

def should_delete(path):
    try:
        with open(path, 'r') as fh:
            j = json.load(fh)
    except Exception:
        # malformed files -> back them up and delete
        return True
    interfaces = j.get('interfaces') if isinstance(j, dict) else None
    if not interfaces:
        return True
    return False

def backup_and_remove(path):
    base = os.path.basename(path)
    ts = datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
    dest = os.path.join(BACKUP_DIR, f"{base}.{ts}.bak")
    try:
        os.replace(path, dest)
        print('Moved', path, '->', dest)
    except Exception as e:
        print('Failed to move', path, e)

def main():
    ensure_dirs()
    removed = 0
    for fn in os.listdir(DATA_DIR):
        path = os.path.join(DATA_DIR, fn)
        if os.path.isdir(path):
            continue
        if not fn.lower().endswith('.json'):
            continue
        if should_delete(path):
            backup_and_remove(path)
            removed += 1
    print(f'Removed {removed} files')

if __name__ == '__main__':
    main()
