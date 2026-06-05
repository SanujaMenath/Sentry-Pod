# Syslog Intelligence

## Overview

Captures Cisco IOS syslog messages (severity 0–5) from the GNS3 lab network via a dedicated syslog-ng container, parses them through a bash listener, persists structured alerts to MongoDB, and displays them in real-time on the frontend Dashboard. Provides live operational visibility into device interface changes, OSPF adjacency events, and configuration activity without requiring manual log inspection.

## What Changed

### Created

- `watchman/Dockerfile.syslog-ng` — Ubuntu 24.04 image with syslog-ng 4.3.1 and curl; copies gns3_lab.conf and syslog_listener.sh; exposes UDP 10514
- `watchman/playbooks/gns3_lab.conf` — syslog-ng 4.11 configuration: UDP source on `0.0.0.0:10514` with `flags(no-parse)`, file destination per-host in `/var/log/syslog/$HOST/debug.log`, program destination piping raw `<HOST> <MESSAGE>` lines to syslog_listener.sh
- `watchman/scripts/syslog_listener.sh` — reads stdin line by line, parses Cisco IOS `%FACILITY-SEVERITY-MNEMONIC: message` format, extracts source IP (two-tier fallback) and device hostname from message body, POSTs JSON to Watchman API for severity ≤5
- `watchman/app/models/syslog.py` — `SyslogAlert` (response) and `SyslogAlertCreate` (request) Pydantic models with fields: device, severity, severity_name, facility, mnemonic, message, timestamp, source_ip, msg_hostname

### Modified

- `watchman/app/routes/syslog_routes.py` — three FastAPI endpoints under `/api/syslog`; added `_load_hostname_to_ip()` for reverse hostname→IP resolution; `POST /alerts` now uses msg_hostname from the listener to resolve the actual device IP
- `watchman/app/main.py` — imported and registered `syslog_routes.router`
- `watchman/app/database.py` — exports `syslog_alerts_collection = db.get_collection("syslog_alerts")`; `AsyncIOMotorClient` configured with `tz_aware=True` to preserve UTC timestamps
- `frontend/src/pages/Dashboard.jsx` — added `syslogAlerts` state with 5-second polling interval; rendered Syslog Intelligence card with colored severity badges (rose for 0–1, orange for 2–3, amber for 4–5), device name, mnemonic, message preview, and relative timestamps
- `podman-compose.yaml` — added `syslog-ng` service with Ubuntu-based build, UDP port mapping 10514, and bind mounts for config, script, and data dirs
- `watchman/playbooks/syslog.yml` — added `logging origin-id hostname` and `logging on` to the syslog configuration pushed to all devices

## Architecture

```
GNS3 Lab
  R1, ESW1..14
    │  syslog UDP 10514
    │  (logging origin-id hostname configured on each device)
    ▼
┌──────────────────────────────────────────────┐
│ Host (virbr0: 192.168.122.1)                  │
│  rootlessport (PID) listens on *:10514/udp    │
│  ┌── podman network (10.89.0.0/24) ──────┐   │
│  │  syslog-ng container (10.89.0.x)       │   │
│  │    source s_gns3_network (UDP :10514)  │   │
│  │       │                                 │   │
│  │       ├──► d_gns3_nodes                 │   │
│  │       │    file /var/log/syslog/$HOST/  │   │
│  │       │         debug.log               │   │
│  │       │                                 │   │
│  │       └──► d_listener                   │   │
│  │            program() ──► bash listener  │   │
│  │                │                        │   │
│  │                │ POST /api/syslog/alerts │   │
│  │                ▼                        │   │
│  │         Watchman API (FastAPI)           │   │
│  │                │                        │   │
│  │                │ insert                  │   │
│  │                ▼                        │   │
│  │         MongoDB (syslog_alerts)          │   │
│  └──────────────────────────────────────────┘   │
│                │ GET /api/syslog/alerts (poll)   │
│                ▼                                 │
│         Frontend Dashboard                       │
└──────────────────────────────────────────────┘
```

## Key Discovery: Rootlessport Source IP Rewriting

rootless Podman uses a userspace proxy (`rootlessport`) for port forwarding. When a UDP packet arrives at `192.168.122.1:10514/udp`, the proxy reads it and creates a **new** UDP connection to the container. The source IP of this new connection is the podman bridge gateway (`10.89.0.1`), NOT the original sender's IP. This means:

- `$HOST` in syslog-ng is always the podman gateway IP (e.g., `10.89.0.58`)
- The file destination writes to `/var/log/syslog/10.89.0.58/debug.log`, not `10.0.0.40/debug.log`
- The bash listener sees `source_ip = 10.89.0.58`

This is not fixable without switching to host networking (`network_mode: host`) which has security implications. Instead, the listener extracts the **hostname** from the message body (added by `logging origin-id hostname` on the Cisco device) and sends it as `msg_hostname` to the API. The API then reverse-resolves it to the actual device IP via `hosts.ini`.

## File-by-File Detail

### 1. `watchman/Dockerfile.syslog-ng`

Single-stage Ubuntu 24.04 build. Installs `syslog-ng` and `curl` (for the bash listener). Copies config and listener script (also mounted as volumes for dev iteration), marks script as executable, exposes UDP 10514, and runs syslog-ng in foreground with `--stderr` for container logging.

### 2. `watchman/playbooks/gns3_lab.conf`

Syslog-ng 4.11 config with three stanzas:

- **source `s_gns3_network`**: UDP listener on `0.0.0.0:10514` with 1 MB receive buffer and `flags(no-parse)`. The `no-parse` flag is critical — it prevents syslog-ng from stripping the Cisco `%FACILITY` prefix from `$MESSAGE` during RFC 3164 parsing.
- **destination `d_gns3_nodes`**: per-host file destination at `/var/log/syslog/$HOST/debug.log` with auto-created directories. `$HOST` is the rewritten podman gateway IP (see Key Discovery above).
- **destination `d_listener`**: pipes every message through `syslog_listener.sh` using the `program()` driver. Template is `"${HOST} ${MESSAGE}\n"` — prepending the source IP (podman gateway) before the raw message body so the listener has both pieces of information.
- **log path**: joins source to both destinations for parallel persistence + forwarding.

### 3. `watchman/scripts/syslog_listener.sh`

Bash script that reads stdin line by line. The flow for each line:

```
line = "10.89.0.58 <189>79: ESW13: .Jun  5 09:14:54.277: %LINK-5-CHANGED: Interface FastEthernet1/10, changed state to administratively down"
```

**Step 1 — Split source IP and message:**
```
source_ip = "10.89.0.58"          # first field (podman gateway — always wrong for device id)
rest      = "<189>79: ESW13: .Jun  5 09:14:54.277: %LINK-5-CHANGED: ..."
```

**Step 2 — Extract hostname from message body:**
```
Regex: ^<[0-9]+>([0-9]+: )?([A-Za-z][A-Za-z0-9_.-]*): \.?(Jan|Feb|...|Dec)
```
- Matches the syslog <PRI> (and optional sequence number)
- Captures the word between `SEQ: ` and `: `.MONTH` as the hostname candidate
- `\.?` handles Cisco `datetime msec` format which adds a dot before the month (`.Jun` instead of `Jun`)
- Verifies the captured word is NOT a month abbreviation (to avoid false matches when `logging origin-id` is not configured)
- Result: `msg_hostname = "ESW13"`

**Step 3 — Fallback IP extraction (when no hostname found):**
```
candidate_raw = everything before first %
candidate_ip  = last whitespace-delimited field of candidate_raw
```
If the candidate is a valid IPv4, use it as source_ip. This handles `nc` test messages where the device IP is injected into the message body.

**Step 4 — Parse Cisco severity format:**
```
Regex: %([A-Za-z0-9_/-]+)-([0-7])-([A-Za-z0-9_/-]+): (.*)
```
- Group 1: facility (e.g., `LINK`, `SYS`, `LINEPROTO`)
- Group 2: severity (0-7 integer, filters to ≤5)
- Group 3: mnemonic (e.g., `CHANGED`, `UPDOWN`, `CONFIG_I`)
- Group 4: message text

**Step 5 — POST to API:**
Builds JSON with `source_ip`, `facility`, `severity`, `severity_name`, `mnemonic`, `message`, and conditionally `msg_hostname` if a hostname was extracted. Posts to `http://host.containers.internal:8000/api/syslog/alerts`.

### 4. `watchman/app/models/syslog.py`

Two Pydantic models:

- **`SyslogAlertCreate`**: incoming shape — `source_ip`, `facility`, `severity` (int), `severity_name`, `mnemonic`, `message`, optional `timestamp`, optional `msg_hostname`
- **`SyslogAlert`**: full document shape — same fields plus `device` (resolved hostname or fallback to source_ip) and required `timestamp`

### 5. `watchman/app/routes/syslog_routes.py`

Three FastAPI endpoints and two resolver functions:

**`_load_ip_to_hostname()`** — reads `watchman/playbooks/hosts.ini`, builds `{ip: hostname}` mapping. Parses line-by-line (not via ConfigParser) because Ansible INI format uses `hostname ansible_host=IP other_vars=...` which ConfigParser cannot handle.

**`_load_hostname_to_ip()`** — reverse mapping `{hostname: ip}` built from the same hosts.ini file.

**`GET /api/syslog/alerts?limit=50`** — fetches most recent N alerts sorted by timestamp descending; returns `list[SyslogAlert]`.

**`POST /api/syslog/alerts`** — accepts `SyslogAlertCreate`, applies two-tier device resolution:

1. If `msg_hostname` is provided and found in `host_to_ip` mapping → use that IP as `effective_ip` and hostname as `effective_hostname` (device shows as `ESW13 (10.2.99.13)`)
2. Fallback: look up `alert.source_ip` in `ip_to_host` mapping (catches cases where rootlessport doesn't rewrite, or direct API calls)
3. Final fallback: use `effective_ip` directly (device shows as `10.89.0.58`)

**`DELETE /api/syslog/alerts`** — removes all documents; returns `{"deleted_count": N}`.

Timezone handling: uses `tz_aware=True` in the MongoDB client so timestamps preserve the `Z` (UTC) suffix from ISO 8601.

### 6. `frontend/src/pages/Dashboard.jsx`

The Syslog Intelligence card:

- State variable `syslogAlerts` initialized as empty array
- `useEffect` fetches alerts on mount from `http://127.0.0.1:8000/api/syslog/alerts` and sets up a 5-second polling interval (cleaned up on unmount)
- Renders an alert count badge (e.g., "5 alerts" or "Listening...")
- Maps each alert to a card with:
  - Color coding: red/rose for Emergency/Alert (0–1), orange for Critical/Error (2–3), amber for Warning/Notification (4–5)
  - Severity name badge (e.g., "NOTIFICATION")
  - Device field shows `Hostname (IP)` like `ESW13 (10.2.99.13)`
  - Relative time (minutes ago)
  - Mnemonic (e.g., `ADJCHG`, `UPDOWN`, `CONFIG_I`)
  - Message text (truncated with `line-clamp-2`)
- Empty state guidance: "No critical syslog messages received yet. Flap an interface on a device to trigger an alert."

### 7. `watchman/playbooks/syslog.yml`

Ansible playbook targeting `allHosts` that pushes syslog configuration to every GNS3 device:

```yaml
- logging host 192.168.122.1 transport udp port 10514
- logging trap 5
- logging facility local7
- service timestamps log datetime msec
- logging origin-id hostname      # ← adds hostname to syslog messages
- logging on                       # ← enables syslog transmission
```

`logging origin-id hostname` is critical — it embeds the device hostname (e.g., `ESW13`) in each syslog message. The bash listener extracts this hostname to identify the sender, which is necessary because rootlessport rewrites the source IP.

`logging on` must be explicitly enabled on Cisco IOS devices; without it, messages appear on the console but are never forwarded to the logging host.

### 8. `podman-compose.yaml`

Syslog-ng service definition:

```yaml
syslog-ng:
  build:
    context: ./watchman
    dockerfile: Dockerfile.syslog-ng
  ports:
    - "10514:10514/udp"
  volumes:
    - ./watchman/playbooks/gns3_lab.conf:/etc/syslog-ng/conf.d/gns3_lab.conf:Z
    - ./watchman/scripts/syslog_listener.sh:/usr/local/bin/syslog_listener.sh:Z
    - ./watchman/playbooks/syslog/:/var/log/syslog/:z
```

Config and script are mounted as volumes (`:Z` — private relabeling) for fast iteration without rebuilding the image. The syslog data directory uses `:z` (shared relabeling) since multiple containers may need access.

## Data Flow

```
1. GNS3 Cisco device generates syslog (e.g., interface flap)
2. Device sends UDP datagram to 192.168.122.1:10514
3. Packet arrives at host virbr0 (192.168.122.1)
4. rootlessport userspace proxy receives on *:10514/udp
5. rootlessport creates new UDP connection → syslog-ng container :10514
   (⚠ source IP rewritten to podman gateway 10.89.0.x)
6. syslog-ng receives via s_gns3_network with flags(no-parse)
   → $HOST = podman gateway IP, $MESSAGE = full payload including <PRI>
7. log statement routes to both destinations:
   a. d_gns3_nodes → writes to /var/log/syslog/10.89.0.x/debug.log
   b. d_listener → pipes "${HOST} ${MESSAGE}\n" to syslog_listener.sh
8. syslog_listener.sh:
   a. Splits first field as source_ip (podman gateway — to be overridden)
   b. Extracts hostname from message body via regex
      (e.g., "ESW13" from "<189>79: ESW13: .Jun 5...")
   c. Falls back to IP extraction from message body if no hostname found
   d. Parses %FAC-SEV-MNEMONIC: format, filters ≤5
   e. curl POSTs JSON to http://host.containers.internal:8000/api/syslog/alerts
9. FastAPI route receives alert:
   a. If msg_hostname is present, look up hostname→IP in hosts.ini
      (e.g., "ESW13" → "10.2.99.13")
   b. device = "ESW13 (10.2.99.13)"
   c. If no msg_hostname, fall back to IP→hostname lookup
   d. If neither resolves, device = raw source_ip
10. Inserts SyslogAlert document into syslog_alerts collection
11. Frontend poll every 5s: GET /api/syslog/alerts → updates state
12. Dashboard re-renders Syslog Intelligence card with new alerts
```

## Usage

### From the UI

1. Navigate to the Dashboard (`/dashboard`)
2. The Syslog Intelligence card appears in the bottom row alongside the Configuration Drift card
3. Alerts appear automatically as they arrive (polled every 5 seconds)
4. Each card shows: severity badge (color-coded), device hostname, mnemonic, message preview, and relative time
5. To clear all alerts, send a DELETE request to the API (no UI button yet)

### From the CLI

```bash
# Test the pipeline manually (without origin-id — falls back to podman IP)
echo "Jun  5 07:30:00 192.168.122.252 %LINEPROTO-5-UPDOWN: Line protocol on Interface GigabitEthernet0/1, changed state to down" | nc -u -w1 127.0.0.1 10514

# Test with origin-id hostname format (resolves device correctly)
echo "<189>97: ESW4: Jun  5 13:57:30: %SYS-5-CONFIG_I: Configured from console by console" | nc -u -w1 192.168.122.1 10514

# Test with msec timestamp format (leading dot before month)
echo "<189>79: ESW13: .Jun  5 09:14:54.277: %LINK-5-CHANGED: Interface FastEthernet1/10, changed state to administratively down" | nc -u -w1 192.168.122.1 10514

# Check persisted alerts
curl http://127.0.0.1:8000/api/syslog/alerts | jq .

# Clear all alerts
curl -X DELETE http://127.0.0.1:8000/api/syslog/alerts

# Run the syslog configuration playbook on all devices
python watchman/scripts/container_manager.py run syslog.yml

# Generate real alerts by flapping an interface via Ansible
ansible R1 -i watchman/playbooks/hosts.ini -m cisco.ios.ios_config \
  -a "parents='interface FastEthernet0/1' lines=['shutdown','no shutdown']"
```

### Via the API

```bash
# List recent alerts
curl http://127.0.0.1:8000/api/syslog/alerts

# List with custom limit
curl "http://127.0.0.1:8000/api/syslog/alerts?limit=10"

# Create an alert manually
curl -X POST http://127.0.0.1:8000/api/syslog/alerts \
  -H "Content-Type: application/json" \
  -d '{
    "source_ip": "10.89.0.58",
    "msg_hostname": "R1",
    "facility": "LINEPROTO",
    "severity": 5,
    "severity_name": "Notification",
    "mnemonic": "UPDOWN",
    "message": "Line protocol on Interface FastEthernet0/1, changed state to up"
  }'

# Delete all alerts
curl -X DELETE http://127.0.0.1:8000/api/syslog/alerts
```

## Design Notes

- **Rootlessport source IP rewriting** is the central challenge of this integration. rootless Podman's userspace proxy for UDP port forwarding creates a new connection to the container, losing the original sender IP. The solution is two-tier: (1) Cisco devices inject their hostname via `logging origin-id hostname`, (2) the bash listener extracts it, (3) the API reverse-resolves hostname→IP from `hosts.ini`. If a device lacks `logging origin-id hostname`, it falls back to the podman gateway IP.
- **`host.containers.internal:8000`** is used in the bash listener (not the `watchman` Compose service name) because watchman runs directly on the host during development, not as a container. This address resolves to the Podman host from inside any container.
- **`flags(no-parse)`** on the syslog-ng UDP source prevents syslog-ng from stripping the Cisco `%FACILITY` prefix. The raw `$MESSAGE` includes the full `<PRI>SEQ: HOSTNAME: TIMESTAMP: %FAC-SEV-MNEMONIC: msg` format, which the bash listener parses.
- **`\.?` in the hostname regex** handles Cisco's `service timestamps log datetime msec` format which outputs `.Jun  5 09:14:54.277` — with a leading dot before the month abbreviation. Without `\.?`, only the first word (e.g., `Jun`) was captured instead of the preceding hostname.
- **Severity filter (≤5)** deliberately omits Informational (6) and Debug (7) messages to keep the dashboard focused on actionable events. Cisco IOS generates a high volume of level-6 syslogs that would overwhelm the display.
- **5-second polling** was chosen over SSE/WebSockets for simplicity. The frontend's existing Dashboard pattern uses polling for other data (drift, network status), so syslog follows the same convention. Can be upgraded to SSE if latency requirements tighten.
- **IP→hostname resolution** reads `hosts.ini` at request time (not cached) so inventory changes take effect immediately without a restart. Custom line-by-line parser handles Ansible's `hostname ansible_host=IP other_vars=...` format which ConfigParser cannot parse.
- **The bash listener** is intentionally lightweight and stateless. If the API is unreachable, the curl silently fails and the message is still persisted to the file destination. No message queuing is implemented; this is acceptable for a demo/management network.
- **SELinux volume labels**: `:z` (shared) for the syslog data directory so multiple containers can read/write; `:Z` (private) for config and script mounts since only the syslog-ng container needs access. On Fedora, rootless Podman containers cannot write to bind mounts without proper SELinux labels.
- **`logging origin-id hostname`** must be configured on every Cisco device that sends syslog. The `syslog.yml` playbook applies it to all 14 devices in the lab. This command embeds the device hostname in the syslog message, enabling the bash listener to identify the sender despite rootlessport's IP rewriting. It is NOT available on all IOS versions — verify compatibility before deploying.
- **`logging on`** is required on Cisco IOS for syslog messages to actually be transmitted. Without it, messages appear on the console but are never sent to the logging host. The `syslog.yml` playbook includes this command for every device.
- **No authentication** on the `/api/syslog` endpoints — alerts arrive from inside the container network where the bash listener has no token. If exposed beyond localhost, add API key or JWT validation matching the rest of the app.
- **Future improvements**: migrate to `network_mode: host` for the syslog-ng container to preserve original source IPs (removing the need for hostname extraction); upgrade to SSE for real-time push instead of 5s polling; add auto-clear or alert deduplication if dashboard gets noisy.
