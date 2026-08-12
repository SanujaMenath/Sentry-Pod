"""
One-time cleanup: rebuild the playbooks catalog.
  - Purges all dead/test entries from the MongoDB 'playbooks' collection.
  - Seeds clean metadata for the 20 canonical playbooks.
  - Regenerates catalog.json to match (same shape as sync_catalog_from_db).

MongoDB remains the source of truth; catalog.json is the derived artifact.
Reads MONGO_URI from .env (Atlas).
"""
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

ATLAS_URI = os.getenv("MONGO_URI")
DB_NAME = "sentry_pod_db"
PLAYBOOKS_DIR = Path(__file__).parent.parent / "playbooks"
CATALOG_PATH = PLAYBOOKS_DIR / "catalog.json"

# filename, name, description, tags, target_devices, example_intents, destructive, severity
PLAYBOOKS = [
    {
        "filename": "collect_facts.yml",
        "name": "Collect Device Facts",
        "description": "Gathers Cisco IOS facts from all hosts and writes a JSON file per device for inventory and topology refreshes.",
        "tags": ["facts", "inventory", "topology", "cisco", "ios"],
        "target_devices": ["allHosts"],
        "example_intents": ["collect device facts", "gather facts", "refresh topology data", "update device inventory"],
        "destructive": False,
        "severity": "low",
    },
    {
        "filename": "show_os_version.yml",
        "name": "Show OS Version",
        "description": "Collects device facts and prints the OS version of each host.",
        "tags": ["facts", "report", "cisco", "ios"],
        "target_devices": ["allHosts"],
        "example_intents": ["show os version", "what ios version", "check device software"],
        "destructive": False,
        "severity": "low",
    },
    {
        "filename": "collect_cdp_neighbors.yml",
        "name": "Collect CDP Neighbors",
        "description": "Runs 'show cdp neighbors' on all hosts and saves the output to build the network topology.",
        "tags": ["cdp", "topology", "discovery"],
        "target_devices": ["allHosts"],
        "example_intents": ["discover cdp neighbors", "collect cdp output", "rebuild topology"],
        "destructive": False,
        "severity": "low",
    },
    {
        "filename": "collect_golden_config.yml",
        "name": "Collect Golden Config Baseline",
        "description": "Saves the running-config of every host as the golden baseline for drift detection.",
        "tags": ["config", "baseline", "drift"],
        "target_devices": ["allHosts"],
        "example_intents": ["save golden config", "create baseline", "backup running config"],
        "destructive": False,
        "severity": "low",
    },
    {
        "filename": "collect_running_config.yml",
        "name": "Collect Running Config Snapshot",
        "description": "Captures the current running-config of every host as a temporary snapshot for drift comparison.",
        "tags": ["config", "drift", "snapshot"],
        "target_devices": ["allHosts"],
        "example_intents": ["snapshot current config", "collect running config"],
        "destructive": False,
        "severity": "low",
    },
    {
        "filename": "check_config_drift.yml",
        "name": "Check Configuration Drift",
        "description": "Compares each host's golden baseline against the current snapshot and generates a drift report.",
        "tags": ["drift", "compliance", "config"],
        "target_devices": ["allHosts"],
        "example_intents": ["check config drift", "find configuration drift", "compliance check"],
        "destructive": False,
        "severity": "low",
    },
    {
        "filename": "backup_and_commit_config.yml",
        "name": "Backup and Commit Config",
        "description": "Backs up the running-config to dated folders and writes it to NVRAM on every host.",
        "tags": ["backup", "config", "write"],
        "target_devices": ["allHosts"],
        "example_intents": ["backup running config", "save config to nvram", "write memory"],
        "destructive": False,
        "severity": "medium",
    },
    {
        "filename": "enable_cdp.yml",
        "name": "Enable CDP",
        "description": "Enables CDP globally on all hosts.",
        "tags": ["cdp", "config"],
        "target_devices": ["allHosts"],
        "example_intents": ["enable cdp", "turn on cdp"],
        "destructive": False,
        "severity": "low",
    },
    {
        "filename": "set_logging_timestamps.yml",
        "name": "Set Logging Timestamps",
        "description": "Sets local time logging timestamps so syslog messages carry local time.",
        "tags": ["logging", "syslog", "time"],
        "target_devices": ["allHosts"],
        "example_intents": ["fix logging time", "set logging timestamps"],
        "destructive": False,
        "severity": "low",
    },
    {
        "filename": "configure_ntp.yml",
        "name": "Configure NTP",
        "description": "Configures NTP clients, timezone, and associations on all hosts.",
        "tags": ["ntp", "time", "config"],
        "target_devices": ["allHosts"],
        "example_intents": ["configure ntp", "setup time sync", "set ntp server"],
        "destructive": False,
        "severity": "medium",
    },
    {
        "filename": "configure_snmp.yml",
        "name": "Configure SNMP",
        "description": "Configures an SNMPv2c read-only community and enables traps on all hosts.",
        "tags": ["snmp", "monitoring", "config"],
        "target_devices": ["allHosts"],
        "example_intents": ["configure snmp", "enable snmp traps", "setup snmp monitoring"],
        "destructive": False,
        "severity": "medium",
    },
    {
        "filename": "configure_syslog.yml",
        "name": "Configure Syslog",
        "description": "Configures syslog forwarding, trap level, facility, and timestamps. Host/port are parameterized.",
        "tags": ["syslog", "logging", "config"],
        "target_devices": ["allHosts"],
        "example_intents": ["configure syslog", "send logs to syslog server", "enable logging"],
        "destructive": False,
        "severity": "medium",
    },
    {
        "filename": "configure_default_gateway.yml",
        "name": "Configure Default Gateway",
        "description": "Sets the IP default gateway on access switches.",
        "tags": ["gateway", "routing", "config"],
        "target_devices": ["Access_Switches"],
        "example_intents": ["set default gateway", "configure default gateway"],
        "destructive": False,
        "severity": "medium",
    },
    {
        "filename": "configure_end_device_port.yml",
        "name": "Configure End Device Port",
        "description": "Configures an access-switch port as a shut/no-shut access port on a given VLAN for an end device.",
        "tags": ["access", "vlan", "port"],
        "target_devices": ["Access_Switches"],
        "example_intents": ["configure end device port", "set access port vlan"],
        "destructive": False,
        "severity": "medium",
    },
    {
        "filename": "configure_vlans.yml",
        "name": "Configure VLANs",
        "description": "Creates VLANs and trunk links on access switches.",
        "tags": ["vlan", "config"],
        "target_devices": ["Access_Switches"],
        "example_intents": ["create vlans", "configure vlans", "add vlan"],
        "destructive": False,
        "severity": "medium",
    },
    {
        "filename": "configure_ntp_edge.yml",
        "name": "Configure NTP on Edge Routers",
        "description": "Configures NTP and timezone specifically on edge routers.",
        "tags": ["ntp", "time", "config"],
        "target_devices": ["Edge_routers"],
        "example_intents": ["configure ntp on edge routers", "sync time on edge"],
        "destructive": False,
        "severity": "medium",
    },
    {
        "filename": "configure_ospf.yml",
        "name": "Configure OSPF Routing",
        "description": "Advertises VLAN networks into OSPF area 0 on distribution switches.",
        "tags": ["ospf", "routing", "config"],
        "target_devices": ["Distribution_Switches"],
        "example_intents": ["configure ospf", "enable ospf routing", "advertise networks"],
        "destructive": False,
        "severity": "high",
    },
    {
        "filename": "configure_vlan_routing.yml",
        "name": "Configure Inter-VLAN Routing",
        "description": "Creates VLANs and trunk links on distribution switches for inter-VLAN routing.",
        "tags": ["vlan", "routing", "trunk"],
        "target_devices": ["Distribution_Switches"],
        "example_intents": ["configure inter vlan routing", "setup vlan trunking"],
        "destructive": False,
        "severity": "high",
    },
    {
        "filename": "configure_hsrp_intervlan.yml",
        "name": "Configure HSRP for Inter-VLAN Routing",
        "description": "Sets up HSRP gateways for inter-VLAN routing on distribution switches.",
        "tags": ["hsrp", "routing", "redundancy"],
        "target_devices": ["Distribution_Switches"],
        "example_intents": ["configure hsrp", "setup hsrp gateways"],
        "destructive": False,
        "severity": "high",
    },
    {
        "filename": "configure_hsrp_active.yml",
        "name": "Configure HSRP Active Routers",
        "description": "Sets HSRP priority and preempt on the active routers of each VLAN.",
        "tags": ["hsrp", "redundancy", "config"],
        "target_devices": ["HSRP_Routers"],
        "example_intents": ["configure hsrp active", "set hsrp priority"],
        "destructive": False,
        "severity": "high",
    },
]


def catalog_entries():
    return [
        {
            "filename": p["filename"],
            "name": p["name"],
            "description": p["description"],
            "tags": p["tags"],
            "target_devices": p["target_devices"],
            "example_intents": p["example_intents"],
            "destructive": p["destructive"],
            "severity": p["severity"],
        }
        for p in PLAYBOOKS
    ]


def write_catalog_json():
    CATALOG_PATH.write_text(json.dumps(catalog_entries(), indent=2) + "\n", encoding="utf-8")
    print(f"Wrote catalog.json with {len(PLAYBOOKS)} entries")


def main():
    if not ATLAS_URI:
        print("ERROR: MONGO_URI not found in .env")
        return

    client = MongoClient(ATLAS_URI)
    playbooks_col = client[DB_NAME].playbooks

    deleted = playbooks_col.delete_many({}).deleted_count
    print(f"Purged {deleted} existing playbook entries from MongoDB")

    now = datetime.now(timezone.utc).isoformat() + "Z"
    docs = []
    for p in PLAYBOOKS:
        doc = {
            "name": p["name"],
            "filename": p["filename"],
            "description": p["description"],
            "engine_type": "Ansible",
            "subnet_scope": ", ".join(p["target_devices"]),
            "pipeline_status": "Verified",
            "tags": p["tags"],
            "target_devices": p["target_devices"],
            "example_intents": p["example_intents"],
            "destructive": p["destructive"],
            "severity": p["severity"],
            "file_path": str(PLAYBOOKS_DIR / p["filename"]),
            "last_executed": "Never Executed",
            "timestamp_created": now,
            "last_modified": now,
        }
        docs.append(doc)

    result = playbooks_col.insert_many(docs)
    print(f"Seeded {len(result.inserted_ids)} playbooks into MongoDB")

    write_catalog_json()

    client.close()


if __name__ == "__main__":
    main()
