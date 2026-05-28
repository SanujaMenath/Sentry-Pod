import subprocess
import json
import os
import re

# Configuration
HOSTS_FILE = "watchman/playbooks/hosts.ini"
COMMUNITY = "sentryPod"
# Target OIDs: MAC notification table + interface description (ifDescr)
MAC_OID = ".1.3.6.1.4.1.9.9.276.1.1.1.1.1"
IFDESCR_OID = ".1.3.6.1.2.1.2.2.1.2"
OIDS = [MAC_OID, IFDESCR_OID]
OUTPUT_DIR = "watchman/playbooks/snmp_output"

os.makedirs(OUTPUT_DIR, exist_ok=True)

def parse_ansible_all_hosts(filepath):
    hosts = []
    if not os.path.exists(filepath):
        print(f"[!] Error: {filepath} not found.")
        return hosts

    in_all_hosts_section = False
    with open(filepath, 'r') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith((';', '#')):
                continue

            if line.startswith('['):
                if line.lower() == '[allhosts]':
                    in_all_hosts_section = True
                    continue
                else:
                    in_all_hosts_section = False
                    continue

            if in_all_hosts_section:
                match = re.search(r'ansible_host=([^\s]+)', line)
                if match:
                    ip = match.group(1)
                    if ip not in hosts:
                        hosts.append(ip)
    return hosts

target_hosts = parse_ansible_all_hosts(HOSTS_FILE)
print(f"Parsed {len(target_hosts)} unique host IPs from the [allHosts] section.\n")

for host in target_hosts:
    print(f"Polling {host} via Bulkwalk...")
    
    # Use snmpbulkwalk for speed; walk both MAC counters and ifDescr
    combined_lines = []
    for oid in OIDS:
        cmd = ["snmpbulkwalk", "-v2c", "-c", COMMUNITY, host, oid]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            lines = [line.strip() for line in result.stdout.splitlines() if line.strip()]
            if lines and not (len(lines) == 1 and "error" in lines[0].lower()):
                combined_lines.extend(lines)
        except subprocess.TimeoutExpired:
            print(f"  [!] Error: Timeout pulling OID {oid} from {host}")
        except Exception as e:
            print(f"  [!] Error pulling OID {oid} from {host}: {e}")

    if not combined_lines:
        print(f"  [!] Warning: No valid data returned from {host}")
        continue

    payload = {
        "host": host,
        "raw_snmp_output": combined_lines
    }

    filepath = os.path.join(OUTPUT_DIR, f"{host}_mac_notifications.json")
    try:
        with open(filepath, "w") as f:
            json.dump(payload, f, indent=2)
        print(f"  -> Saved {len(combined_lines)} lines to {filepath}")
    except Exception as e:
        print(f"  [!] Error saving output for {host}: {e}")

print("\nDone! Storage sweep complete across all available nodes.")