# Refresh Device Facts

## Overview

One-time Ansible `get_facts` run that populates the MongoDB `devices` collection with real model, version, uptime, CPU, and memory data. Cards read from MongoDB (highest priority in the 3-layer merge), so mock/default data is replaced after one refresh. Subsequent refreshes only overwrite auto-discovered fields (model, version, uptime, CPU, memory) while preserving user-set fields (name, IP, type).

## What Changed

### Modified
- `watchman/playbooks/get_facts.yml` — added 2 tasks: create `facts/` dir, write per-device JSON via `to_json` filter
- `watchman/app/routes/network_routes.py` — added async SSE generator `_refresh_facts_generator()` and `GET /api/network/refresh-facts` route
- `frontend/src/pages/NetworkDevices.jsx` — added "Refresh Facts" button + `RefreshFactsModal` integration + `loadDevices()` extraction for auto-refetch
- `frontend/src/services/networkService.js` — added `getRefreshFactsUrl()` helper

### Created
- `frontend/src/components/RefreshFactsModal.jsx` — progress overlay with SSE log consumption, dismiss-to-background, floating toast indicator
- `watchman/playbooks/facts/.gitkeep` — output directory for per-device fact JSON files

## Architecture

```
Browser                          Watchman (FastAPI)              sentry-ansible container
  │                                    │                                │
  │  GET /api/network/refresh-facts    │                                │
  │  (EventSource / SSE)               │                                │
  │ ────────────────────────────────→  │                                │
  │                                    │  podman run get_facts.yml      │
  │  data: {"type":"output",...}       │ ─────────────────────────────→ │
  │ ←────────────────────────────────  │                                │
  │  data: {"type":"status",...}       │                                │ cisco.ios.ios_facts
  │ ←────────────────────────────────  │                                │ ──────────→ devices
  │                                    │                                │ ←──────────
  │                                    │                                │ write JSON
  │                                    │                                │ ──────────→ facts/*.json
  │                                    │ parse facts/*.json             │
  │                                    │ ──────────→ MongoDB devices    │
  │  data: {"type":"complete",...}     │                                │
  │ ←────────────────────────────────  │                                │
  │                                    │                                │
  │  GET /api/network/devices          │                                │
  │  (auto-refetch on complete)        │                                │
  │ ────────────────────────────────→  │                                │
  │  ←─────── enriched data ────────── │                                │
```

## File-by-File Detail

### 1. `watchman/playbooks/get_facts.yml`

Two new tasks added after the existing `ios_facts` collection:

```yaml
- name: Ensure facts output directory exists
  ansible.builtin.file:
    path: /ansible/facts
    state: directory
    mode: '0755'

- name: Write device facts to JSON
  ansible.builtin.copy:
    content: "{{ {...} | to_json }}"
    dest: "/ansible/facts/{{ inventory_hostname }}.json"
```

The `playbooks/` directory is volume-mounted as `/ansible` in the container, so files persist on the host.

### 2. `watchman/app/routes/network_routes.py` — `GET /api/network/refresh-facts`

SSE endpoint using `StreamingResponse` with an async generator:

1. Clears `playbooks/facts/` directory
2. Runs `get_facts.yml` via `asyncio.create_subprocess_exec` (streaming stdout line-by-line)
3. Parses each `facts/*.json` file
4. Computes `memory` % from `memfree_mb` / `memtotal_mb`
5. Upserts to MongoDB `devices` collection:
   - `$set`: model, version, uptime, cpu, memory, online, serial, last_fact_refresh
   - `$setOnInsert`: id, name, ip, type (preserved on re-runs)
6. Yields SSE events: `output`, `status`, `counts`, `complete`, `error`

### 3. `frontend/src/components/RefreshFactsModal.jsx`

- Consumes SSE stream from `/api/network/refresh-facts`
- Displays live log lines in a scrollable monospace view
- **Dismiss-to-background**: Clicking X hides the overlay but keeps the EventSource alive; a floating toast "Refreshing device facts..." appears bottom-right
- On `complete`/`error`: waits 1.5s if dismissed, then calls `onComplete()` → `loadDevices()` → unmounts
- `source.onerror` checks `doneRef.current` to suppress spurious "Connection lost" on normal stream termination

### 4. `frontend/src/pages/NetworkDevices.jsx`

- Extracted `loadDevices()` from `useEffect` for reuse
- Added "Refresh Facts" button (slate/grey, left of blue "Add Device")
- `onComplete` callback re-fetches `GET /api/network/devices` so cards update automatically

## Data Flow

```
User clicks "Refresh Facts"
    │
    ▼
EventSource(GET /api/network/refresh-facts)
    │
    ▼ (SSE stream)
┌─────────────────────────────────────────────────────────┐
│ Backend (network_routes.py)                             │
│                                                         │
│  1. Clear playbooks/facts/                              │
│  2. Run: podman run ... get_facts.yml                   │
│     ┌─────────────────────────────────────────────────┐ │
│     │ Container: sentry-ansible                       │ │
│     │   cisco.ios.ios_facts on each of 16 devices     │ │
│     │   Write JSON → /ansible/facts/{hostname}.json   │ │
│     └─────────────────────────────────────────────────┘ │
│  3. Parse facts/*.json                                  │
│  4. Upsert to MongoDB devices collection                │
│     - $set: model, version, uptime, cpu, mem, online    │
│     - $setOnInsert: name, ip, type                      │
│  5. Yield SSE: output, status, counts, complete         │
└─────────────────────────────────────────────────────────┘
    │
    ▼
Modal shows live logs → dismiss → floating toast
    │
    ▼ (on complete)
loadDevices() → GET /api/network/devices → cards update
```

## Usage

### From the UI
1. Navigate to **Network Devices** (`/network-devices`)
2. Click **Refresh Facts** button (top-right, next to Add Device)
3. Watch the live log as facts are gathered (one-time, ~2-5 min for 16 devices)
4. Click X to send to background — a small toast confirms it's still running
5. When complete, cards automatically show real data (model, version, CPU, memory)

### Via the API
```bash
curl -N http://localhost:8000/api/network/refresh-facts
```

## Design Notes

- **Why not run get_facts on every card load?** It's slow (SSH to 16 devices, gather all subsets). One-time persistence via MongoDB avoids blocking the UI.
- **Why `$setOnInsert` for name/ip/type?** Preserves any user edits (e.g., renaming a device or correcting its IP) across refresh runs. Facts only overwrite auto-discovered fields.
- **Why keep raw JSON files?** Debugging and manual inspection. The `playbooks/facts/` directory on the host persists across container restarts.
- **Why async subprocess via `create_subprocess_exec` instead of reusing `playbook_service.run_playbook`?** The existing service function is synchronous and wraps output in a `PlaybookResponse`. For SSE streaming with per-line progress, async I/O is cleaner.
- **SSE vs WebSocket:** SSE is simpler for one-way server→client streaming. No reconnection logic needed since this is a one-shot operation.
