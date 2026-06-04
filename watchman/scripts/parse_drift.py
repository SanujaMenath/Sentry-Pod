import os
import re

# Define the path where Ansible saves the drift reports
DRIFT_DIR = "../playbooks/configDrift"
if not os.path.exists(DRIFT_DIR) and os.path.exists("/ansible/configDrift"):
    DRIFT_DIR = "/ansible/configDrift"

def clean_ansi_codes(text):
    """Removes ANSI escape sequences to make the output human-readable."""
    ansi_escape = re.compile(r'\x1b\[[0-9;]*m')
    return ansi_escape.sub('', text)

def analyze_drift():
    if not os.path.exists(DRIFT_DIR):
        print(f"[-] Directory '{DRIFT_DIR}' does not exist. Run the Ansible playbook first.")
        return

    # Filter out files that match your naming convention and aren't empty
    drift_files = [f for f in os.listdir(DRIFT_DIR) if f.startswith("DRIFT_") and f.endswith(".diff")]
    
    total_drifted_devices = len(drift_files)
    
    print("=" * 50)
    print(f"  CONFIG DRIFT AUDIT REPORT")
    print(f"Total Devices with Drift: {total_drifted_devices}")
    print("=" * 50)
    
    if total_drifted_devices == 0:
        print("[+] Excellent! All devices match their Golden Baseline.")
        return

    for filename in drift_files:
        # Extract host name from filename (e.g., DRIFT_R1.diff -> R1)
        hostname = filename.replace("DRIFT_", "").replace(".diff", "")
        file_path = os.path.join(DRIFT_DIR, filename)
        
        print(f"\n  Device: {hostname}")
        print(f"   Report: {file_path}")
        print("   Key Changes Found:")
        
        with open(file_path, 'r', encoding='utf-8') as file:
            content = file.read()
            clean_content = clean_ansi_codes(content)
            
            # Print just the lines showing additions or removals to keep it brief
            lines = clean_content.splitlines()
            change_count = 0
            for line in lines:
                # Target lines starting with + or - but ignore the header lines (--- or +++)
               if (line.startswith('+') or line.startswith('-')) and not (line.startswith('+++') or line.startswith('---')):
        # Skip the verbose default sub-traps to keep the summary concise
                if "enable traps" in line and not any(core in line for core in ["syslog", "hsrp", "snmp "]):
                 continue
                    
            if change_count == 0:
                print("     (File contains metadata or timestamp differences only)")

if __name__ == "__main__":
    analyze_drift()