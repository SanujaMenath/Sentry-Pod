#!/usr/bin/env python3
"""
Nmap scanner script that runs nmap against a hosts file and updates active_devices.json
"""
import os
import json
import subprocess
import re
from datetime import datetime
from pathlib import Path

# Device configuration mapping from hosts.ini
DEVICE_CONFIG = {
    "192.168.122.252": {"name": "R1", "type": "router", "model": "Cisco ISR", "version": "16.x"},
    "10.0.0.2": {"name": "R2", "type": "router", "model": "Cisco ISR", "version": "16.x"},
    "10.0.0.10": {"name": "ESW1", "type": "switch", "model": "Cisco Catalyst", "version": "17.x"},
    "10.0.0.20": {"name": "ESW2", "type": "switch", "model": "Cisco Catalyst", "version": "17.x"},
    "10.0.0.30": {"name": "ESW3", "type": "switch", "model": "Cisco Catalyst", "version": "17.x"},
    "10.0.0.40": {"name": "ESW4", "type": "switch", "model": "Cisco Catalyst", "version": "17.x"},
    "10.0.0.50": {"name": "ESW5", "type": "switch", "model": "Cisco Catalyst", "version": "17.x"},
    "10.0.0.60": {"name": "ESW6", "type": "switch", "model": "Cisco Catalyst", "version": "17.x"},
    "10.1.99.7": {"name": "ESW7", "type": "switch", "model": "Cisco Catalyst", "version": "15.x"},
    "10.1.99.8": {"name": "ESW8", "type": "switch", "model": "Cisco Catalyst", "version": "15.x"},
    "10.1.99.9": {"name": "ESW9", "type": "switch", "model": "Cisco Catalyst", "version": "15.x"},
    "10.1.99.10": {"name": "ESW10", "type": "switch", "model": "Cisco Catalyst", "version": "15.x"},
    "10.2.99.11": {"name": "ESW11", "type": "switch", "model": "Cisco Catalyst", "version": "15.x"},
    "10.2.99.12": {"name": "ESW12", "type": "switch", "model": "Cisco Catalyst", "version": "15.x"},
    "10.2.99.13": {"name": "ESW13", "type": "switch", "model": "Cisco Catalyst", "version": "15.x"},
    "10.2.99.14": {"name": "ESW14", "type": "switch", "model": "Cisco Catalyst", "version": "15.x"},
}

# Default metrics for devices
DEFAULT_METRICS = {
    "router": {"cpu": 40, "memory": 60, "uptime": "45d"},
    "switch": {"cpu": 30, "memory": 50, "uptime": "70d"},
}


def get_repo_root():
    """Get the watchman directory (contains nmap_output/ and scripts/)"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.abspath(os.path.join(script_dir, ".."))


def run_nmap(hosts_file: str) -> dict:
    """Run nmap and return online IPs"""
    print(f"Running nmap scan on {hosts_file}...")
    
    try:
        result = subprocess.run(
           ["nmap", "-sT", "-Pn", "-p", "22", "--open", "-n", "--max-rtt-timeout", "1000ms", "-iL", hosts_file],
            capture_output=True,
            text=True,
            timeout=120
        )
        
        # Parse nmap output for online hosts
        online_ips = []
        lines = result.stdout.split("\n")
        
        for i, line in enumerate(lines):
            # Look for "Nmap scan report for X.X.X.X"
            if "Nmap scan report for" in line:
                match = re.search(r"(\d+\.\d+\.\d+\.\d+)", line)
                if match:
                    ip = match.group(1)
                    # Check if next line says "Host is up"
                    if i + 1 < len(lines) and "Host is up" in lines[i + 1]:
                        online_ips.append(ip)
        
        print(f"Found {len(online_ips)} online hosts")
        return {"online": online_ips, "raw_output": result.stdout}
        
    except FileNotFoundError:
        print("ERROR: nmap not found. Install it with: sudo apt install nmap")
        return {"online": [], "raw_output": ""}
    except subprocess.TimeoutExpired:
        print("ERROR: nmap scan timed out")
        return {"online": [], "raw_output": ""}
    except Exception as e:
        print(f"ERROR: {str(e)}")
        return {"online": [], "raw_output": ""}


def build_active_devices(online_ips: list) -> dict:
    """Build active_devices.json structure from online IPs"""
    devices = []
    device_id = 1
    
    for ip in sorted(online_ips, key=lambda x: tuple(map(int, x.split(".")))):
        if ip in DEVICE_CONFIG:
            config = DEVICE_CONFIG[ip]
            device_type = config["type"]
            metrics = DEFAULT_METRICS.get(device_type, {"cpu": 30, "memory": 50, "uptime": "60d"})
            
            device = {
                "id": device_id,
                "name": config["name"],
                "ip": ip,
                "status": "online",
                "type": config["type"],
                "model": config["model"],
                "version": config["version"],
                "uptime": metrics["uptime"],
                "cpu": metrics["cpu"],
                "memory": metrics["memory"],
            }
            devices.append(device)
            device_id += 1
    
    return {"devices": devices, "scan_timestamp": datetime.now().isoformat()}


def save_active_devices(data: dict, output_file: str) -> bool:
    """Save active devices to JSON file"""
    try:
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        print(f"Saved active devices to {output_file}")
        return True
    except Exception as e:
        print(f"ERROR: Failed to save active devices: {str(e)}")
        return False


def main():
    repo_root = get_repo_root()
    hosts_file = os.path.join(repo_root, "nmap_output", "hosts.txt")
    output_file = os.path.join(repo_root, "nmap_output", "active_devices.json")
    
    # Verify hosts file exists
    if not os.path.exists(hosts_file):
        print(f"ERROR: Hosts file not found: {hosts_file}")
        return 1
    
    # Run nmap scan
    scan_result = run_nmap(hosts_file)

    # Build and save active devices (even when 0 hosts are up — overwrites stale data)
    active_devices = build_active_devices(scan_result["online"])
    if not save_active_devices(active_devices, output_file):
        return 1

    count = len(active_devices["devices"])
    print(f"Scan complete: {count} device{'s' if count != 1 else ''} online")
    return 0


if __name__ == "__main__":
    exit(main())
