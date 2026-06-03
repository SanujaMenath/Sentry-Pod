#!/bin/bash
# Save file to: watchman/playbooks/run_baseline_refresh.sh

# Stop immediately if any command inside errors out
set -e

echo "--- Step 1: Polling SNMP bulkwalk on allHosts ---"
python3 /scripts/collect_snmp.py

echo -e "\n--- Step 2: Parsing raw metrics into per_interface_metrics.json ---"
python3 /scripts/parse_metrics.py

echo -e "\n--- Step 3: Counting telemetried hosts ---"
METRICS_FILE="/ansible/snmp_output/per_interface_metrics.json"
if [ -f "$METRICS_FILE" ]; then
    HOST_COUNT=$(python3 -c "import json; d=json.load(open('$METRICS_FILE')); print(len({i.get('host') for i in d.get('interfaces', []) if i.get('host')}))")
else
    HOST_COUNT=0
fi
echo "Total Hosts Telemetried: $HOST_COUNT"

echo -e "\nWorkflow complete."
