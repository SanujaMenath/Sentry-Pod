import subprocess
import json
import os
import re
from datetime import datetime

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
HOSTS_FILE = os.path.join(REPO_ROOT, "playbooks", "hosts.ini")
COMMUNITY = "sentryPod"
MAC_OID = ".1.3.6.1.4.1.9.9.276.1.1.1.1.1"
IFDESCR_OID = ".1.3.6.1.2.1.2.2.1.2"
IFADMIN_OID = ".1.3.6.1.2.1.2.2.1.7"
IFOPER_OID = ".1.3.6.1.2.1.2.2.1.8"
OIDS = [MAC_OID, IFDESCR_OID, IFADMIN_OID, IFOPER_OID]
OUTPUT_DIR = os.path.join(REPO_ROOT, "playbooks", "snmp_output")
INPUT_DIR = OUTPUT_DIR

if not os.path.exists(HOSTS_FILE) and os.path.exists("/ansible/hosts.ini"):
    HOSTS_FILE = "/ansible/hosts.ini"
    OUTPUT_DIR = "/ansible/snmp_output"
    INPUT_DIR = OUTPUT_DIR

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


def collect_snmp():
    target_hosts = parse_ansible_all_hosts(HOSTS_FILE)
    print(f"Parsed {len(target_hosts)} unique host IPs from the [allHosts] section.\n")
    for host in target_hosts:
        print(f"Polling {host} via Bulkwalk...")
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
        payload = {"host": host, "raw_snmp_output": combined_lines}
        filepath = os.path.join(OUTPUT_DIR, f"{host}_mac_notifications.json")
        try:
            with open(filepath, "w") as f:
                json.dump(payload, f, indent=2)
            print(f"  -> Saved {len(combined_lines)} lines to {filepath}")
        except Exception as e:
            print(f"  [!] Error saving output for {host}: {e}")
    print("\nDone! Storage sweep complete across all available nodes.")


def clean_interface_name(val_str):
    name = re.sub(re.compile(r'^(string:\s*|hex-string:\s*)', re.IGNORECASE), '', val_str)
    return name.replace('"', '').strip()


def normalize_status(val_str):
    return re.sub(r'\(.*\)$', '', val_str).strip().lower()


def parse_metrics():
    if not os.path.exists(INPUT_DIR):
        print(f"[!] Input directory {INPUT_DIR} does not exist.")
        return
    report = {"generated_at": datetime.now().isoformat(), "interfaces": []}
    mac_re = re.compile(r'\.(\d+)\s*=\s*\w+32:\s*(\d+)\s*$')
    ifdescr_re = re.compile(r'\.(\d+)\s*=\s*STRING:\s*(.+)\s*$', re.IGNORECASE)
    ifadmin_re = re.compile(r'ifAdminStatus\.(\d+)\s*=\s*INTEGER:\s*(.+)\s*$', re.IGNORECASE)
    ifoper_re = re.compile(r'ifOperStatus\.(\d+)\s*=\s*INTEGER:\s*(.+)\s*$', re.IGNORECASE)
    files = [f for f in os.listdir(INPUT_DIR) if f.endswith('_mac_notifications.json')]
    if not files:
        print(f"[!] No raw files found in {INPUT_DIR}")
        return
    print("Parsing raw metrics into per-interface objects...")
    for filename in files:
        filepath = os.path.join(INPUT_DIR, filename)
        with open(filepath, 'r') as f:
            try:
                data = json.load(f)
            except Exception:
                continue
            host = data.get("host")
            raw_lines = data.get("raw_snmp_output", [])
            host_descriptions = {}
            host_counters = {}
            host_admin_status = {}
            host_oper_status = {}
            for line in raw_lines:
                mac_match = mac_re.search(line)
                if mac_match:
                    idx = mac_match.group(1)
                    val = int(mac_match.group(2))
                    host_counters[idx] = val
                    continue
                desc_match = ifdescr_re.search(line)
                if desc_match:
                    idx = desc_match.group(1)
                    name = clean_interface_name(desc_match.group(2))
                    host_descriptions[idx] = name
                    continue
                admin_match = ifadmin_re.search(line)
                if admin_match:
                    idx = admin_match.group(1)
                    host_admin_status[idx] = normalize_status(admin_match.group(2))
                    continue
                oper_match = ifoper_re.search(line)
                if oper_match:
                    idx = oper_match.group(1)
                    host_oper_status[idx] = normalize_status(oper_match.group(2))
            for idx, counter in host_counters.items():
                interface_name = host_descriptions.get(idx, f"Interface-idx-{idx}")
                interface_entry = {
                    "host": host,
                    "interface_index": int(idx),
                    "interface_name": interface_name,
                    "ciscoMacNotification": counter,
                    "ifAdminStatus": host_admin_status.get(idx),
                    "ifOperStatus": host_oper_status.get(idx),
                    "unique_key": f"{host}_{interface_name.lower().replace('/', '_')}"
                }
                report["interfaces"].append(interface_entry)
    output_report = os.path.join(OUTPUT_DIR, "per_interface_metrics.json")
    with open(output_report, 'w') as f:
        json.dump(report, f, indent=2)
    print(f"[✓] Complete! Modeled {len(report['interfaces'])} individual interface targets.")
    print(f"    Saved report to: {output_report}")


if __name__ == "__main__":
    collect_snmp()
    parse_metrics()
