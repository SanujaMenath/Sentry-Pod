#!/bin/bash
set -e

ACTION="${1:?Usage: $0 {collect|refresh|drift}"

case "$ACTION" in
  collect)
    echo "--- Step 1: Running collect_golden_config.yml to save golden state baselines ---"
    ansible-playbook collect_golden_config.yml -i hosts.ini

    echo -e "\n--- Step 2: Counting baselined devices ---"
    COUNT=$(ls -1 ./goldenState/GS_*.txt 2>/dev/null | wc -l)
    echo "Total Devices Baselined: $COUNT"
    ;;

  refresh)
    echo "--- Step 1: Polling SNMP bulkwalk on allHosts ---"
    python3 /scripts/collect_and_parse_snmp.py

    echo -e "\n--- Step 2: Counting telemetried hosts ---"
    METRICS_FILE="/ansible/snmp_output/per_interface_metrics.json"
    if [ -f "$METRICS_FILE" ]; then
        HOST_COUNT=$(python3 -c "import json; d=json.load(open('$METRICS_FILE')); print(len({i.get('host') for i in d.get('interfaces', []) if i.get('host')}))")
    else
        HOST_COUNT=0
    fi
    echo "Total Hosts Telemetried: $HOST_COUNT"
    ;;

  drift)
    echo "--- Step 1: Running collect_running_config.yml ---"
    ansible-playbook collect_running_config.yml -i hosts.ini

    echo -e "\n--- Step 2: Running check_config_drift.yml to generate diffs ---"
    ansible-playbook check_config_drift.yml -i hosts.ini

    echo -e "\n--- Step 3: Parsing drift reports via Python ---"
    python3 ../scripts/parse_drift.py
    ;;

  *)
    echo "Unknown action: $ACTION"
    echo "Usage: $0 {collect|refresh|drift}"
    exit 1
    ;;
esac

echo -e "\nWorkflow complete."
