#!/bin/bash
# Save file to: watchman/playbooks/run_baseline_collection.sh

# Stop immediately if any command inside errors out
set -e

echo "--- Step 1: Running goldenState.yml to save golden state baselines ---"
ansible-playbook goldenState.yml -i hosts.ini

echo -e "\n--- Step 2: Counting baselined devices ---"
# Count files matching GS_*.txt in the goldenState directory
COUNT=$(ls -1 ./goldenState/GS_*.txt 2>/dev/null | wc -l)
echo "Total Devices Baselined: $COUNT"

echo -e "\nWorkflow complete."
