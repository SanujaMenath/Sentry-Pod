#!/bin/bash
# Save file to: watchman/playbooks/run_drift_analysis.sh

# Stop immediately if any command inside errors out
set -e

echo "--- Step 1: Running NowRunning.yml ---"
ansible-playbook NowRunning.yml -i hosts.ini

echo -e "\n--- Step 2: Running configDrift.yml to generate diffs ---"
ansible-playbook configDrift.yml -i hosts.ini

echo -e "\n--- Step 3: Parsing drift reports via Python ---"
# Because watchman/scripts/ sits right outside the mounted playbooks folder on the host,
# it is accessed via the parent directory structure inside the container setup.
python3 ../scripts/parse_drift.py

echo -e "\nWorkflow complete."