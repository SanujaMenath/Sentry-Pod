import os
import json
import re
from datetime import datetime

INPUT_DIR = "watchman/playbooks/snmp_output"
OUTPUT_REPORT = "watchman/playbooks/snmp_output/per_interface_metrics.json"

def clean_interface_name(val_str):
    """Cleans up SNMP string formatting from interface names."""
    # Removes 'String: ', quotes, or hex indicators if present
    name = re.sub(re.compile(r'^(string:\s*|hex-string:\s*)', re.IGNORECASE), '', val_str)
    return name.replace('"', '').strip()

def process_to_per_interface():
    if not os.path.exists(INPUT_DIR):
        print(f"[!] Input directory {INPUT_DIR} does not exist.")
        return

    report = {
        "generated_at": datetime.now().isoformat(),
        "interfaces": [] # This will be a clean, flattenable collection array
    }

    # Match the Cisco MAC metrics table
    mac_re = re.compile(r'\.(\d+)\s*=\s*\w+32:\s*(\d+)\s*$')
    # Match standard interface descriptions if captured (fallback logic included)
    ifdescr_re = re.compile(r'\.(\d+)\s*=\s*STRING:\s*(.+)\s*$', re.IGNORECASE)

    files = [f for f in os.listdir(INPUT_DIR) if f.endswith('_mac_notifications.json')]
    if not files:
        print(f"[!] No raw files found in {INPUT_DIR}")
        return

    print(f"Parsing raw metrics into per-interface objects...")

    for filename in files:
        filepath = os.path.join(INPUT_DIR, filename)
        with open(filepath, 'r') as f:
            try:
                data = json.load(f)
            except Exception:
                continue

            host = data.get("host")
            raw_lines = data.get("raw_snmp_output", [])

            # Temp storage to match names and counters for this specific host
            host_descriptions = {}
            host_counters = {}

            for line in raw_lines:
                # 1. Look for MAC Notification metrics
                mac_match = mac_re.search(line)
                if mac_match:
                    idx = mac_match.group(1)
                    val = int(mac_match.group(2))
                    host_counters[idx] = val
                    continue

                # 2. Look for Interface names if they were bundled in the walk
                desc_match = ifdescr_re.search(line)
                if desc_match:
                    idx = desc_match.group(1)
                    name = clean_interface_name(desc_match.group(2))
                    host_descriptions[idx] = name

            # 3. Consolidate into a flat data collection structure
            for idx, counter in host_counters.items():
                # Fallback to a clean string index representation if descriptions aren't captured
                interface_name = host_descriptions.get(idx, f"Interface-idx-{idx}")
                
                interface_entry = {
                    "host": host,
                    "interface_index": int(idx),
                    "interface_name": interface_name,
                    "ciscoMacNotification": counter,
                    "unique_key": f"{host}_{interface_name.lower().replace('/', '_')}"
                }
                report["interfaces"].append(interface_entry)

    with open(OUTPUT_REPORT, 'w') as f:
        json.dump(report, f, indent=2)

    print(f"[✓] Complete! Modeled {len(report['interfaces'])} individual interface targets.")
    print(f"    Saved report to: {OUTPUT_REPORT}")

if __name__ == "__main__":
    process_to_per_interface()