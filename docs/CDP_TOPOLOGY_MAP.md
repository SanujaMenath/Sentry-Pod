# CDP-Based Topology Map

## Overview

Auto-discovers network topology by collecting CDP neighbor data from all devices, parsing the output into nodes and edges, assigning tiers via a combination of BFS auto-discovery and hardcoded overrides, and rendering an interactive vertical-tiered map on the frontend using React Flow.

## What Changed

### Created

| File | Purpose |
|---|---|
| `watchman/playbooks/getCDPNeighbors.yml` | Ansible playbook that runs `show cdp neighbors detail` (with brief fallback) on all devices and saves raw output to `cdp_output/<hostname>.txt` |
| `watchman/app/services/topology_service.py` | CDP output parser (detail + brief format), BFS tier discovery, graph builder, MongoDB storage, and refresh orchestrator |
| `watchman/app/routes/topology_routes.py` | Three API endpoints: `GET /api/topology/graph`, `POST /api/topology/refresh`, `GET /api/topology/refresh-stream` (SSE) |
| `frontend/src/services/topologyService.js` | Axios wrappers for the two blocking API calls |
| `command-center/src/services/topologyService.js` | Identical mirror for the production build |

### Modified

| File | Change |
|---|---|
| `watchman/playbooks/catalog.json` | Added `getCDPNeighbors.yml` catalog entry with `destructive: false`, low severity |
| `watchman/app/main.py` | Added `from app.routes import topology_routes` + `app.include_router(topology_routes.router)` |
| `frontend/src/components/PageHeader.jsx` | Added optional `textColor` and `subtextColor` props for dark-background usage |
| `command-center/src/components/PageHeader.jsx` | Same props added |
| `frontend/src/pages/TopologyMap.jsx` | Full rewrite: static stub replaced with React Flow canvas, tiered auto-layout, custom nodes, search/highlight, detail panel |
| `command-center/src/pages/TopologyMap.jsx` | Full rewrite, identical to frontend copy |

### Packages installed

| Package | Version | Where |
|---|---|---|
| `@xyflow/react` | 12.11.0 | `frontend/` and `command-center/` |

## Architecture

```
Browser (React Flow)      Watchman (FastAPI)           Ansible Container       Dynamips Lab
     │                         │                            │                      │
     │  GET /api/topology/graph│                            │                      │
     │────────────────────────>│                            │                      │
     │  { nodes, edges,        │  reads topology_cache      │                      │
     │    last_refreshed }     │  from MongoDB              │                      │
     │<────────────────────────│                            │                      │
     │                         │                            │                      │
     │  POST /api/topology/    │                            │                      │
     │  refresh                │                            │                      │
     │────────────────────────>│                            │                      │
     │                         │  podman run                │                      │
     │                         │───────────────────────────>│                      │
     │                         │                            │  SSH show cdp        │
     │                         │                            │  neighbors detail    │
     │                         │                            │─────────────────────>│
     │                         │                            │  raw CDP output      │
     │                         │                            │<─────────────────────│
     │                         │                            │                      │
     │                         │  saves to cdp_output/*.txt │                      │
     │                         │<───────────────────────────│                      │
     │                         │                            │                      │
     │                         │  parses all .txt files     │                      │
     │                         │  BFS tier discovery        │                      │
     │                         │  builds graph              │                      │
     │                         │  stores in MongoDB         │                      │
     │                         │                            │                      │
     │  { nodes, edges }       │                            │                      │
     │<────────────────────────│                            │                      │
```

## File-by-File Detail

### 1. `watchman/playbooks/getCDPNeighbors.yml`

Ansible playbook targeting `[allHosts]` with three sequential tasks:

1. **Ensure output dir** — Creates `cdp_output/` inside the mounted volume for Python to read later
2. **Show CDP neighbors detail** — Runs `show cdp neighbors detail` via `cisco.ios.ios_command`; `ignore_errors: true` so unreachable devices don't abort
3. **Brief fallback** — If `cdp_detail` fails, runs `show cdp neighbors` (the columnar brief format); `ignore_errors: true`
4. **Save** — Writes the output to `/ansible/cdp_output/<inventory_hostname>.txt` via `delegate_to: localhost`

Key design choices:
- `ignore_errors` on both commands so one flaky device doesn't block the rest
- Each device gets its own file; Python reads all files in the directory
- Files persist in the mounted volume across playbook runs

### 2. `watchman/app/services/topology_service.py`

The core backend service. Four major sections:

**CDP Parsers** (detail + brief):

- **Detail format** (`_parse_detail_entry`): Regex extracts fields from multi-entry `show cdp neighbors detail` output. Entries are separated by 25+ dashes. Each entry contains labeled fields: `Device ID`, `IP address`, `Platform`, `Capabilities`, `Interface`, `Port ID`. The `Capabilities` field determines tier classification (e.g., `"Router"` → edge).

- **Brief format** (`_parse_brief_line`): Handles the columnar `show cdp neighbors` output. Columns are separated by 2+ spaces. Single-letter capability codes (R, S, H, etc.) are expanded via `_CAPABILITY_MAP` (e.g., `"R"` → `"Router"`).

- **Domain stripping**: Both parsers call `_strip_domain()` to remove `.lab.local` suffixes from device IDs, preventing duplicate nodes when the same device reports with and without a domain.

- **Format detection**: `_is_brief_format()` checks for the column headers; if absent, assumes detail format.

**Tier Discovery** (`discover_tiers`):

Two-layer approach:

1. **BFS auto-discovery**:
   - Build adjacency graph from all neighbor pairs
   - Identify edge devices: any device whose CDP capabilities contain `"Router"`
   - BFS from edge devices: depth 1 → Core, depth 2 → Distribution, depth 3+ → Access
   - Devices not reached by BFS → `"unknown"`

2. **Hardcoded override** (`DEVICE_TIER` dict):
   - Applied AFTER BFS, overriding any auto-discovered tier for known devices
   - Covers all 16 lab devices (R1-2, ESW1-14)
   - Add new devices here as the network grows

**Graph Builder** (`build_graph`):

- Deduplicates devices from neighbor records into a node list
- Applies tier mapping
- Deduplicates edges (undirected: ESW1--ESW2 and ESW2--ESW1 collapse to one edge)
- Sorts nodes by tier order (edge → core → distribution → access), then alphabetically

**MongoDB Storage**:

Two collections, both auto-created on first use:

| Collection | Schema | Purpose |
|---|---|---|
| `cdp_neighbors` | `{ source_device, source_interface, target_device, target_interface, target_platform, target_capabilities, target_ip, protocol, last_seen }` | Raw neighbor records for historical queries |
| `topology_cache` | `{ _id: "current", nodes: [...], edges: [...], last_refreshed }` | Single-document cache of the computed graph |

**Refresh Orchestrator** (`refresh_topology`):

1. Fires `podman run` with the `getCDPNeighbors.yml` playbook
2. Parses all `cdp_output/*.txt` files
3. If no neighbors found: logs a warning and returns existing cached graph (avoids data loss on failed playbook)
4. Builds graph, stores to both MongoDB collections
5. Returns node/edge/neighbor counts

### 3. `watchman/app/routes/topology_routes.py`

Three endpoints:

| Method | Path | Behavior |
|---|---|---|
| `GET` | `/api/topology/graph` | Returns cached graph from `topology_cache` collection: `{ status, nodes, edges, last_refreshed }`. If no cache exists, returns empty arrays. |
| `POST` | `/api/topology/refresh` | Runs the full pipeline: playbook → parse → build → store. Returns `{ status, result: { nodes, edges, neighbors }, graph }`. |
| `GET` | `/api/topology/refresh-stream` | SSE version of the above. Streams events: `status` (progress messages), `playbook_output` (raw Ansible stdout), `complete` (final graph JSON), `error` (on failure). |

### 4. `frontend/src/pages/TopologyMap.jsx`

React 19 component built on `@xyflow/react` v12.11.0.

**Layout** (`applyLayout`):

- Custom vertical tiered layout (no external layout library)
- Nodes grouped by tier: Edge (top) → Core → Distribution → Access (bottom)
- Within each tier, nodes are center-aligned and evenly spaced horizontally
- The widest tier determines the overall canvas width
- Edge source/target is oriented top-to-bottom by tier order (higher tier = source)
- Edges use `smoothstep` type with arrow markers and interface name labels

**Custom Node** (`TierNode`):

- Color-coded by tier: Edge (blue), Core (violet), Distribution (teal), Access (slate)
- Tier-specific icon: Edge (Shield), Core (Server), Distribution (Router), Access (Wifi)
- Top handle (target from higher tier) + bottom handle (source to lower tier)
- Hover shadow, click opens detail panel

**Search** (controlled by `searchQuery` state):

- Text input in the toolbar with live filtering
- Matches device label or tier (case-insensitive)
- Non-matching nodes dim to 20% opacity
- Edges connecting two non-matching nodes also dim
- Clear button resets

**Neighbor Highlight** (controlled by `highlightedNodeId` state):

- Click a node: glows with blue drop-shadow, its direct neighbors stay at full opacity
- Edges connecting the highlighted node stay at full opacity with highlighted color
- Everything else dims to 10-20% opacity
- Click empty canvas to clear

**Style Engine** (`syncStyles`):

- A stable `useCallback` that reads current search/highlight state from refs (not closure)
- Called from `fetchGraph` after loading data, and from a `useEffect` watching `searchQuery`/`highlightedNodeId`
- Both features stack: a node must match BOTH search AND highlight to stay visible

**Empty State**:

- First visit (no cached data): shield icon + "No Topology Data" message + "Refresh Now" button
- Subsequent visits: cached data renders immediately, no auto-refresh
- Manual click runs the playbook; old map stays visible during refresh

**Detail Panel**:

- Slide-out panel on the right when a node is clicked
- Shows: tier, IP address (if available), platform (if available), connected links with interface names
- Close button or click canvas to dismiss

### 5. `frontend/src/services/topologyService.js`

Thin wrappers around the centralized axios instance:
```js
export const getTopologyGraph = () => api.get("/api/topology/graph");
export const refreshTopology = () => api.post("/api/topology/refresh");
```

## Data Flow

### Page Load (cached data exists)

```
Browser                         Watchman                        MongoDB
  │                                │                              │
  │ fetchGraph()                   │                              │
  │ GET /api/topology/graph        │                              │
  │───────────────────────────────>│                              │
  │                                │ find({_id: "current"})       │
  │                                │─────────────────────────────>│
  │                                │ { nodes, edges, ts }         │
  │                                │<─────────────────────────────│
  │ { nodes: [...], edges: [...],  │                              │
  │   last_refreshed: "..." }      │                              │
  │<───────────────────────────────│                              │
  │                                │                              │
  │ applyLayout(nodes, edges)      │                              │
  │ syncStyles() → set opacity 1   │                              │
  │ React Flow renders             │                              │
  │ user sees the cached map       │                              │
```

### Manual Refresh

```
Browser                         Watchman                      Ansible Container
  │                                │                              │
  │ handleRefresh()                │                              │
  │ POST /api/topology/refresh     │                              │
  │───────────────────────────────>│                              │
  │                                │ get_podman_command()         │
  │                                │ asyncio.create_subprocess    │
  │                                │─────────────────────────────>│
  │                                │                              │  ansible-playbook
  │                                │                              │  getCDPNeighbors.yml
  │                                │                              │  ├─ ESW1: show cdp neighbors detail
  │                                │                              │  ├─ ESW2: show cdp neighbors detail
  │                                │                              │  └─ ... (16 devices)
  │                                │                              │
  │                                │ saves to cdp_output/*.txt    │
  │                                │<─────────────────────────────│
  │                                │                              │
  │                                │ parse_all_cdp_files()        │
  │                                │ → 16 files → ~50 records    │
  │                                │                              │
  │                                │ build_graph(neighbors)       │
  │                                │ → discover_tiers()           │
  │                                │   → BFS from edge devices    │
  │                                │   → DEVICE_TIER override     │
  │                                │ → deduplicate nodes/edges    │
  │                                │                              │
  │                                │ store_neighbors() +          │
  │                                │ store_graph() → MongoDB      │
  │                                │                              │
  │ { graph: { nodes: [...],       │                              │
  │   edges: [...] } }             │                              │
  │<───────────────────────────────│                              │
  │                                │                              │
  │ fetchGraph() (re-fetch)        │                              │
  │ old map stays visible          │                              │
  │ → applyLayout + syncStyles     │                              │
  │ → new map swaps in             │                              │
```

## Usage

### From the UI

1. Navigate to **Topology Map** in the sidebar
2. If no cached data exists, click **Refresh Now**
3. The map renders in a vertical tiered layout (Edge → Core → Distribution → Access)
4. **Search**: type a device name or tier in the search box; matching nodes stay bright, others dim
5. **Highlight**: click any node to highlight it and its neighbors; click empty canvas to clear
6. **Details**: clicked node's info panel slides in from the right (tier, IP, platform, interfaces)
7. **Refresh**: click the Refresh button to re-run CDP collection; old map stays visible during refresh

### From the CLI

```bash
# Refresh topology data (runs CDP playbook, parses, stores)
curl -X POST http://localhost:8000/api/topology/refresh

# Get cached graph
curl http://localhost:8000/api/topology/graph

# Stream refresh with progress updates
curl -N http://localhost:8000/api/topology/refresh-stream
```

### Via the API

```bash
# Check if playbook works standalone
python watchman/scripts/container_manager.py run getCDPNeighbors.yml

# Check parsed output files
cat watchman/playbooks/cdp_output/ESW1.txt

# Inspect MongoDB collections
mongosh sentry_pod_db --eval 'db.topology_cache.findOne({_id: "current"})'
mongosh sentry_pod_db --eval 'db.cdp_neighbors.countDocuments()'
```

## Design Notes

- **Why CDP over LLDP?** The lab runs all-Cisco IOS 12.4 Dynamips images. CDP is universally available. The data model includes a `protocol` field to add LLDP parsing later without schema changes.
- **Why custom layout instead of dagre?** For 16-100 devices in a strict 4-tier hierarchy, a hand-rolled center-aligned column layout is simpler, more predictable, and avoids an extra dependency. The layout function is ~50 lines with no `node_modules` cost.
- **Why two MongoDB collections?** `cdp_neighbors` stores raw parsed records for potential future features (inventory, audit trail). `topology_cache` stores the pre-computed graph for fast reads. The graph is recomputed on every refresh (negligible cost for <100 devices).
- **Why DEVICE_TIER override?** The Dynamips 2691 images report `Router` capability even when acting as switches. The BFS auto-discovery treats Router-capable devices as edge, but lab topology has them as core/distribution/access. The hardcoded map corrects this for known devices while still auto-classifying unknown ones.
- **Why refs instead of closure for syncStyles?** The style engine (`syncStyles`) needs to be called from two places: `fetchGraph` (on data load) and a `useEffect` (when search/highlight changes). Using refs for search/highlight state keeps the callback stable (no changing deps) while still reading the latest values.
- **Empty refresh guard**: If the playbook produces zero neighbors (e.g., all devices unreachable), the service returns the existing cached graph instead of overwriting it with empty data. Prevents data loss on transient failures.
- **SSE streaming**: The `/refresh-stream` endpoint provides real-time progress via Server-Sent Events, useful for the Chat Console or automation scripts that need progress feedback. The blocking `/refresh` endpoint is simpler for the React UI.
- **Naming convention**: New features append a numeric suffix to existing doc files (e.g., `CDP_TOPOLOGY_MAP.md`). Files are organized by topic, not by date or sequence number.
