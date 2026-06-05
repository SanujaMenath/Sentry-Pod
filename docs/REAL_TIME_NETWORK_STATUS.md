# Real-Time Network Status

## Overview

Replaces the hardcoded device table in the dashboard's row 3 with a live data-driven component. Each device from `hosts.ini` (16 total) is cross-referenced against nmap ping-scan results to show real online/offline status, with a manual refresh button that triggers a fresh nmap scan. A four-tier cascading algorithm accounts for the network topology so that a complete layer outage correctly marks downstream devices as **degraded** rather than simply offline.

## What Changed

### Created
- `docs/REAL_TIME_NETWORK_STATUS.md` — this document.

### Modified
- `watchman/scripts/nmap_scan.py` — removed early `return 1` when 0 hosts found; script now always saves the result file (even empty) and exits 0, so stale data never persists.
- `watchman/app/routes/network_routes.py` — added `DEVICE_TIER` / `TIER_ORDER` constants, `_build_device_status()` helper with four-tier cascade logic, `GET /api/network/device-status`, and `POST /api/network/device-status/scan` endpoints. Counts are split into `online_count` (only `effective_status == "online"`), `degraded_count`, and `offline_count`.
- `frontend/src/pages/Dashboard.jsx` — added state/fetch/handler for network status, replaced the hardcoded table body with a live data-driven table, added Tier column, three-way status pills (UP/DOWN/DEG), status-reason subtitles, and a refresh button with a summary showing online, degraded, and tier-down counts.

## Topology Logic

### Four-Tier Hierarchy

Devices in `hosts.ini` are organized into four network tiers matching the [Edge/Core/Distribution/Access] model:

| Tier | `hosts.ini` group | Devices | Role |
|---|---|---|---|
| **Edge/WAN** | `[Edge_routers]` | R1, R2 | External connectivity / WAN edge |
| **Core** | `[Core_Switches]` | ESW1, ESW2 | High-speed backbone |
| **Distribution** | `[Distribution_Switches]` | ESW3–ESW6 | Aggregation, routing policy |
| **Access** | `[Access_Switches]` | ESW7–ESW14 | End-device connectivity |

### Cascading Rule

If **every** device in a tier is offline, all lower tiers are automatically marked **degraded** — even if nmap shows them responding — because the network path to/from them is broken.

```
Edge down ──→ Core degraded, Distribution degraded, Access degraded
Core down ──→ Distribution degraded, Access degraded
Distribution down ──→ Access degraded
```

### OSPF Redundancy

OSPF with redundant links means a **single** device failure in an upper tier does **not** trigger the cascade. Traffic is re-routed through the remaining live device(s) in that tier, so lower tiers remain fully reachable.

- **Single device down** → only that device shows `offline`; no cascade (OSPF failover)
- **All devices in a tier down** → cascade triggers; all lower tiers show `degraded`
- **Actual offline** → device did not respond to nmap ping
- **Degraded** → device responded to nmap, but an upper-tier outage makes it effectively isolated

### Per-Device Fields

| Field | Values | Meaning |
|---|---|---|
| `online` | `true` / `false` | Raw nmap ping result |
| `effective_status` | `"online"` / `"offline"` / `"degraded"` | Status after cascade logic |
| `status_reason` | `null` / `"edge_layer_down"` / `"core_layer_down"` / `"distribution_layer_down"` | Why a device is degraded |
| `tier` | `"edge"` / `"core"` / `"distribution"` / `"access"` | Which tier the device belongs to |

### Response Summary

In addition to per-device fields, the top-level response includes aggregate counts and a `tier_summary` block:

| Field | Meaning |
|---|---|
| `online_count` | Devices where `effective_status == "online"` |
| `degraded_count` | Devices where `effective_status == "degraded"` |
| `offline_count` | Remaining devices (`total - online - degraded`) |
| `total_count` | All 16 inventory devices |

A tier is `healthy: false` when **zero** devices in it are online (meaning all are either offline or degraded).

```json
"tier_summary": {
  "edge":  { "total": 2, "online": 2, "healthy": true, "label": "Edge/WAN" },
  "core":  { "total": 2, "online": 2, "healthy": true, "label": "Core" },
  "distribution": { "total": 4, "online": 4, "healthy": true, "label": "Distribution" },
  "access": { "total": 8, "online": 8, "healthy": true, "label": "Access" }
}
```

A tier is `healthy: false` when **zero** devices in it are online.

## Architecture

```
Browser (Dashboard.jsx)
  │
  ├─ GET  /api/network/device-status  ──→  network_routes.py
  │                                          └──build_device_status()
  │                                               ├─ load_devices_from_inventory()  ──→  hosts.ini
  │                                               └─ reads active_devices.json      ──→  nmap_output/
  │
  └─ POST /api/network/device-status/scan ──→  network_routes.py
                                                 ├─ subprocess(nmap_scan.py)  ──→  nmap -sn
                                                 │                                └─ writes active_devices.json
                                                 └─ _build_device_status()
```

## File-by-File Detail

### 1. `watchman/app/routes/network_routes.py`

Three additions (lines 447–539):

**`_build_device_status()`** — Synchronous helper that:
  1. Calls existing `load_devices_from_inventory()` to get all 16 devices from `watchman/playbooks/hosts.ini`.
  2. Reads `nmap_output/active_devices.json` (produced by `nmap_scan.py`) to collect the set of online IPs and their enriched metadata (model, version, uptime).
  3. **Step 1 — Raw status:** iterates every inventory device, sets `online: true/false` based on IP membership, assigns its `tier` from the `DEVICE_TIER` mapping, and merges richer model/version/uptime data from the nmap output for online devices.
  4. **Step 2 — Cascade:** walks tiers top-to-bottom. If an entire tier has zero online devices, all lower tiers are marked `effective_status: "degraded"` with a `status_reason` explaining which layer is down. Otherwise each device gets `"online"` or `"offline"` based on its raw nmap status.
  5. Returns `{ devices, online_count, degraded_count, offline_count, total_count, scan_timestamp, tier_summary }`.

**`GET /api/network/device-status`** — Thin async wrapper around `_build_device_status()`.

**`POST /api/network/device-status/scan`** — Runs `nmap_scan.py` via `asyncio.to_thread(subprocess.run)` with a 180-second timeout (same pattern as the existing `POST /active-devices/scan`), then calls `_build_device_status()` to return the updated status.

Key design choice: the cross-referencing logic lives in a single helper rather than duplicated across GET and POST. The helper is synchronous because it only does file I/O — no need for async.

### 2. `frontend/src/pages/Dashboard.jsx`

**State** (line 45):
```js
const [networkStatus, setNetworkStatus] = useState({
  devices: [], online_count: 0, offline_count: 0,
  degraded_count: 0, total_count: 0, scan_timestamp: null
});
const [isRefreshingNetStatus, setIsRefreshingNetStatus] = useState(false);
```

**Effect** (lines 120–130): Fetches device status on mount from `GET /api/network/device-status`. Errors are silently caught (console only) so a missing backend doesn't crash the dashboard.

**Refresh handler** (lines 151–161): POSTs to `/api/network/device-status/scan`, updates state on success, manages the `isRefreshingNetStatus` spinner flag.

**Table section** (lines 467–580):
- Header is flexbox with the title on the left and a summary badge + Refresh button on the right.
- Summary shows `"online_count / total_count online"`, plus amber `"· N degraded"` if `degraded_count > 0`, and `"· N tier(s) down"` if any tier has zero online devices.
- Refresh button uses the same `bg-emerald-600/20` styling and `animate-spin` pattern as the Active Devices statcard.
- **Tier column** added between Hostname and IP Address. Each device shows a colored badge:
  - Edge/WAN → purple, Core → blue, Distribution → cyan, Access → slate.
- **Three-way status pill**:
  - `"UP"` (green) — device responded and path is available.
  - `"DOWN"` (red) — device did not respond to nmap.
  - `"DEG"` (amber, dashed border) — device responded but an upper tier is fully down.
- **Status reason** shown as a small amber subtitle below the pill when `status_reason` is set (e.g. `"Edge/WAN layer is fully down"`).
- Table body maps over `networkStatus.devices` sorted naturally by name (`localeCompare` with `numeric: true`).
- Each row shows hostname, tier badge, IP, status pill (+ optional reason), model, and last-check time.
- Empty state message when `devices.length === 0`.

## Data Flow

```
1. Dashboard mounts
   └─ useEffect → GET /api/network/device-status
                    └─ _build_device_status()
                         ├─ hosts.ini  ──→ 16 devices
                         ├─ active_devices.json ──→ online IP list
                         ├─ assign tier + raw online/offline
                         ├─ four-tier cascade (edge → core → distribution → access)
                         │   └─ if all devices in a tier are offline → downstream tiers become "degraded"
                         └─ returns { devices, counts, timestamp, tier_summary }

2. User clicks Refresh
   └─ handleRefreshNetStatus()
        └─ POST /api/network/device-status/scan
             ├─ subprocess(nmap_scan.py)
             │    ├─ reads nmap_output/hosts.txt (16 IPs)
             │    ├─ nmap -sn -n --max-rtt-timeout 300ms -iL hosts.txt
             │    └─ writes nmap_output/active_devices.json
             └─ _build_device_status()
                  ├─ (same cascade logic as GET)
                  └─ returns updated { devices, counts, timestamp, tier_summary }

3. setNetworkStatus(response) → React re-render → table shows live data with:
   - Tier badges, three-way status pills, optional status-reason subtitles
```

## Usage

### From the UI
1. Navigate to the **Command Center** dashboard.
2. In the **Real-Time Network Status** card (row 3), view all 16 devices sorted by tier then name.
3. Each device shows a **tier badge** (Edge, Core, Distribution, or Access) in a distinct color.
4. The **status pill** shows one of:
   - **Online** (green) — device responded to nmap and path is available.
   - **Offline** (red) — device did not respond to nmap.
   - **Degraded** (amber, dashed) — device responded to nmap but an upper-tier outage makes it isolated. A subtitle explains which layer is down.
5. The header shows a summary like **"15 / 16 online"**, plus amber **"· 14 degraded"** and **"· 4 tiers down"** indicators when the cascade is active.
6. Click **Refresh** to trigger a new nmap ping scan and update the table.

### Via the API
```bash
# Get current device status
curl -s http://127.0.0.1:8000/api/network/device-status | jq

# Trigger nmap scan and get updated status
curl -s -X POST http://127.0.0.1:8000/api/network/device-status/scan | jq
```

Example response (healthy — no cascade):

```json
{
  "devices": [
    { "id": "r1", "name": "R1", "ip": "192.168.122.252", "type": "router",
      "model": "Cisco ISR", "version": "16.x", "uptime": "45d",
      "cpu": 40, "memory": 60, "online": true,
      "tier": "edge", "effective_status": "online", "status_reason": null },
    { "id": "esw12", "name": "ESW12", "ip": "10.2.99.12", "type": "switch",
      "model": "Cisco IOS Device", "version": "Unknown", "uptime": "N/A",
      "cpu": 0, "memory": 0, "online": false,
      "tier": "access", "effective_status": "offline", "status_reason": null }
  ],
  "online_count": 15,
  "degraded_count": 0,
  "offline_count": 1,
  "total_count": 16,
  "scan_timestamp": "2026-06-03T21:06:47.494221",
  "tier_summary": {
    "edge":  { "total": 2, "online": 2, "healthy": true, "label": "Edge/WAN" },
    "core":  { "total": 2, "online": 2, "healthy": true, "label": "Core" },
    "distribution": { "total": 4, "online": 4, "healthy": true, "label": "Distribution" },
    "access": { "total": 8, "online": 8, "healthy": true, "label": "Access" }
  }
}
```

Example response (edge layer fully down — cascade active):

```json
{
  "devices": [
    { "id": "r1", "name": "R1", "ip": "192.168.122.252",
      "online": false, "tier": "edge",
      "effective_status": "offline", "status_reason": null },
    { "id": "r2", "name": "R2", "ip": "10.0.0.2",
      "online": false, "tier": "edge",
      "effective_status": "offline", "status_reason": null },
    { "id": "esw1", "name": "ESW1", "ip": "10.0.0.10",
      "online": true, "tier": "core",
      "effective_status": "degraded", "status_reason": "edge_layer_down" },
    { "id": "esw7", "name": "ESW7", "ip": "10.1.99.7",
      "online": true, "tier": "access",
      "effective_status": "degraded", "status_reason": "edge_layer_down" }
  ],
  "online_count": 0,
  "degraded_count": 14,
  "offline_count": 2,
  "total_count": 16,
  "scan_timestamp": "...",
  "tier_summary": {
    "edge":  { "total": 2, "online": 0, "healthy": false, "label": "Edge/WAN" },
    "core":  { "total": 2, "online": 2, "healthy": true, "label": "Core" },
    "distribution": { "total": 4, "online": 4, "healthy": true, "label": "Distribution" },
    "access": { "total": 8, "online": 8, "healthy": true, "label": "Access" }
  }
}
```

## Design Notes

- **`nmap_scan.py` always saves, even empty.** Originally the script exited with code 1 when 0 hosts were found, leaving stale `active_devices.json` on disk. This caused both the Real-Time Network Status and Active Devices statcards to show outdated data when the edge layer went down. Now the script always writes the result (even an empty device list) and exits 0.
- **`degraded_count` is separate from `online_count`.** A counting bug in the initial implementation treated `degraded` as online, inflating `online_count` when the cascade was active. These are now distinct counters.
- **No new script.** The existing `nmap_scan.py` already handles nmap execution; the cross-referencing and cascade logic is done entirely in the backend route layer. This avoids duplicating script infrastructure.
- **`load_devices_from_inventory()` reused.** This existing function parses the typed groups from `hosts.ini` and produces deduplicated device dicts. It was left unmodified to avoid impacting the existing `GET /api/network/devices` endpoint.
- **`DEVICE_TIER` is explicit, not inferred.** Rather than modifying `load_devices_from_inventory()` to return tier info (which could break other endpoints), we use a flat dict mapping device names to tiers. This is simple, auditable, and independent of the inventory format.
- **Online enrichment.** For online devices, richer metadata (model, version, uptime) from `nmap_scan.py`'s `DEVICE_CONFIG` mapping is merged over the generic `"Cisco IOS Device"` / `"Unknown"` defaults from the inventory parser.
- **Offline fallback.** Offline devices retain their generic inventory data since `nmap_scan.py` only includes responding hosts in its output.
- **Cascade granularity is per-tier, not per-device.** With OSPF redundancy, a single device failure is survivable. The cascade only triggers when an entire tier is dark — at that point OSPF has no alternate path to the layers below.
- **Degraded vs offline distinction.** A `degraded` device responded to nmap but is effectively unusable because an upper tier is down. Without this distinction, operators would see a green "online" pill for a device that cannot actually pass traffic.
- **Sorting.** Devices are sorted by tier first (edge → core → distribution → access), then naturally by name within each tier using `localeCompare` with `numeric: true`.
- **Timestamp display.** The `scan_timestamp` from `active_devices.json` is formatted with `toLocaleTimeString()` — a future enhancement could show relative time ("2 min ago").
