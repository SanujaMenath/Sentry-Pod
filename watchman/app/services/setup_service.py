from datetime import datetime
from pathlib import Path
from typing import List, Tuple

from app.models.setup import SetupPreviewRequest


BASE_DIR = Path(__file__).parent.parent.parent
PLAYBOOKS_DIR = BASE_DIR / "playbooks"
HOSTS_INI_PATH = PLAYBOOKS_DIR / "hosts.ini"
DOCS_DIR = BASE_DIR / "docs"

DEMO_IP_PATTERNS = ["192.168.122.", "10.0.0."]


def render_ini(payload: SetupPreviewRequest) -> str:
    """Generate a complete hosts.ini from the wizard payload."""
    lines = []
    lines.append("# Sentry-Pod managed inventory")
    lines.append(f"# Generated: {datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')}")
    lines.append("")

    # Collect all unique devices for [allHosts]
    all_devices: List[Tuple] = []
    seen_hosts = set()
    for entry in payload.edge_routers:
        key = entry.hostname.lower()
        if key not in seen_hosts:
            all_devices.append(entry)
            seen_hosts.add(key)
    for entry in payload.core_switches:
        key = entry.hostname.lower()
        if key not in seen_hosts:
            all_devices.append(entry)
            seen_hosts.add(key)
    for entry in payload.distribution_switches:
        key = entry.hostname.lower()
        if key not in seen_hosts:
            all_devices.append(entry)
            seen_hosts.add(key)
    for entry in payload.access_switches:
        key = entry.hostname.lower()
        if key not in seen_hosts:
            all_devices.append(entry)
            seen_hosts.add(key)

    lines.append("[allHosts]")
    for d in all_devices:
        lines.append(f"{d.hostname} ansible_host={d.ip}")
    lines.append("")

    if payload.edge_routers:
        lines.append("[Edge_routers]")
        for d in payload.edge_routers:
            lines.append(f"{d.hostname} ansible_host={d.ip}")
        lines.append("")

    if payload.core_switches:
        lines.append("[Core_Switches]")
        for d in payload.core_switches:
            lines.append(f"{d.hostname} ansible_host={d.ip}")
        lines.append("")

    if payload.distribution_switches:
        lines.append("[Distribution_Switches]")
        for d in payload.distribution_switches:
            lines.append(f"{d.hostname} ansible_host={d.ip}")
        lines.append("")

    hsrp_names = set(h.lower() for h in payload.hsrp_pairs)
    hsrp_devices = [d for d in payload.distribution_switches if d.hostname.lower() in hsrp_names]
    if hsrp_devices:
        lines.append("[HSRP_Routers]")
        for d in hsrp_devices:
            lines.append(f"{d.hostname} ansible_host={d.ip}")
        lines.append("")

    if payload.access_switches:
        lines.append("[Access_Switches]")
        for d in payload.access_switches:
            extra_parts = []
            if d.vlan_id is not None:
                extra_parts.append(f"vlan_id={d.vlan_id}")
            if d.vlan_name:
                extra_parts.append(f"vlan_name={d.vlan_name}")
            if d.default_gateway:
                extra_parts.append(f"defaultGateway={d.default_gateway}")
            extra = " " + " ".join(extra_parts) if extra_parts else ""
            lines.append(f"{d.hostname} ansible_host={d.ip}{extra}")
        lines.append("")

    lines.append("[allHosts:vars]")
    lines.append("ansible_network_os=cisco.ios.ios")
    lines.append("ansible_connection=network_cli")
    lines.append(f"ansible_user={payload.global_creds.ansible_user}")
    lines.append(f"ansible_password={payload.global_creds.ansible_password}")
    lines.append("ansible_become=yes")
    lines.append("ansible_become_method=enable")
    if payload.global_creds.ansible_become_password:
        lines.append(f"ansible_become_password={payload.global_creds.ansible_become_password}")

    return "\n".join(lines) + "\n"


def _parse_device_lines(ini_text: str) -> dict:
    """Extract {hostname: ip} from an INI text, skipping vars sections."""
    devices = {}
    current_section = None
    in_vars = False
    for line in ini_text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or stripped.startswith(";"):
            continue
        if stripped.startswith("[") and stripped.endswith("]"):
            current_section = stripped.strip("[]").lower()
            in_vars = current_section.endswith(":vars")
            continue
        if in_vars:
            continue
        parts = stripped.split()
        if parts:
            hostname = parts[0]
            ip = None
            for p in parts[1:]:
                if p.startswith("ansible_host="):
                    ip = p.split("=", 1)[1]
                    break
            if ip:
                devices[hostname] = ip
    return devices


def compute_diff(current_ini: str, new_ini: str) -> dict:
    """Compare device entries between two INI texts."""
    current = _parse_device_lines(current_ini)
    new = _parse_device_lines(new_ini)

    current_hosts = set(current.keys())
    new_hosts = set(new.keys())

    added = [f"{h} → {new[h]}" for h in sorted(new_hosts - current_hosts)]
    removed = sorted(current_hosts - new_hosts)
    common = current_hosts & new_hosts

    changed = []
    for host in sorted(common):
        if current[host] != new[host]:
            changed.append(f"{host}: {current[host]} → {new[host]}")

    unchanged = sum(1 for h in common if current[h] == new[h])

    return {"added": added, "removed": removed, "changed": changed, "unchanged": unchanged}


def _check_warnings(payload: SetupPreviewRequest) -> List[str]:
    """Validate the wizard payload for common issues."""
    warnings = []
    for d in payload.access_switches:
        if d.default_gateway is None:
            warnings.append(f"{d.hostname}: No default_gateway set — defaultGateway.yml will fail")
        if d.vlan_id is None:
            warnings.append(f"{d.hostname}: No vlan_id set — vlan playbooks may not work correctly")
    if payload.hsrp_pairs and len(payload.hsrp_pairs) < 2:
        warnings.append("HSRP has fewer than 2 devices — HSRP playbooks may not work")
    if not payload.global_creds.snmp_community:
        warnings.append("No SNMP community set — telemetry collection will fail")
    return warnings


def generate_report_markdown(payload: SetupPreviewRequest, diff: dict, warnings: List[str], flush_plan: dict) -> str:
    """Build the markdown onboarding report."""
    now = datetime.utcnow()

    lines = []
    lines.append("# Sentry-Pod Onboarding Report")
    lines.append(f"**Date:** {now.strftime('%Y-%m-%dT%H:%M:%SZ')}")
    lines.append("")
    lines.append("## Summary")
    lines.append("| Group | Count |")
    lines.append("|---|---|")
    lines.append(f"| Edge Routers | {len(payload.edge_routers)} |")
    lines.append(f"| Core Switches | {len(payload.core_switches)} |")
    lines.append(f"| Distribution Switches | {len(payload.distribution_switches)} |")
    if payload.hsrp_pairs:
        lines.append(f"| HSRP Pairs | {len(payload.hsrp_pairs)} |")
    lines.append(f"| Access Switches | {len(payload.access_switches)} |")
    total = (
        len(payload.edge_routers)
        + len(payload.core_switches)
        + len(payload.distribution_switches)
        + len(payload.access_switches)
    )
    lines.append(f"| **Total** | **{total}** |")
    lines.append("")

    ini_content = render_ini(payload)
    lines.append("## Generated hosts.ini")
    lines.append("```ini")
    lines.append(ini_content)
    lines.append("```")
    lines.append("")

    lines.append("## Changes vs Previous Inventory")
    if diff.get("added"):
        lines.append("**Added:**")
        for item in diff["added"]:
            lines.append(f"- {item}")
        lines.append("")
    if diff.get("removed"):
        lines.append("**Removed:**")
        for item in diff["removed"]:
            lines.append(f"- {item}")
        lines.append("")
    if diff.get("changed"):
        lines.append("**Changed:**")
        for item in diff["changed"]:
            lines.append(f"- {item}")
        lines.append("")
    lines.append(f"**Unchanged:** {diff.get('unchanged', 0)} devices")
    lines.append("")

    if warnings:
        lines.append("## Warnings")
        for w in warnings:
            lines.append(f"- {w}")
        lines.append("")

    lines.append("## Flush Plan")
    lines.append("The following demo/cache data will be cleared on apply:")
    lines.append("")
    if flush_plan.get("mongo_collections"):
        lines.append("**MongoDB collections:** " + ", ".join(flush_plan["mongo_collections"]))
    if flush_plan.get("disk_paths"):
        lines.append("**Disk paths:** " + ", ".join(flush_plan["disk_paths"]))
    lines.append("")

    lines.append("---")
    lines.append("*Preview only — no changes written*")
    lines.append("")
    return "\n".join(lines)


def write_report(markdown: str) -> Path:
    """Save the report to docs/ and return the path."""
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"onboarding_report_{datetime.utcnow().strftime('%Y-%m-%d')}.md"
    report_path = DOCS_DIR / filename
    report_path.write_text(markdown, encoding="utf-8")
    return report_path


def read_current_ini() -> str:
    """Read the current hosts.ini from disk, or return empty string."""
    if HOSTS_INI_PATH.exists():
        return HOSTS_INI_PATH.read_text(encoding="utf-8")
    return ""


def write_ini(content: str) -> None:
    """Overwrite hosts.ini with new content."""
    HOSTS_INI_PATH.write_text(content, encoding="utf-8")


async def flush_mongo_collections() -> List[str]:
    """Drop demo device data from MongoDB. Returns list of flushed collection names."""
    from app.database import db
    collections_to_flush = ["devices", "device_configurations", "cdp_neighbors", "topology_cache"]
    flushed = []
    for name in collections_to_flush:
        col = db.get_collection(name)
        result = await col.delete_many({})
        count = result.deleted_count
        flushed.append(f"{name} ({count} docs)")
    return flushed


def flush_disk_artifacts() -> List[str]:
    """Remove cached playbook output files. Returns list of flushed path descriptions."""
    flushed = []

    targets = [
        ("goldenState/", "GS_*.txt"),
        ("configDrift/", "DRIFT_*.diff"),
        ("cdp_output/", "*.txt"),
        ("facts/", "*.json"),
        ("runningConfigs/", "*"),
    ]

    for subdir, pattern in targets:
        path = PLAYBOOKS_DIR / subdir
        if path.exists():
            count = 0
            for f in path.glob(pattern):
                if f.is_file():
                    f.unlink()
                    count += 1
            if count > 0:
                flushed.append(f"{subdir} ({count} files)")

    return flushed


def get_flush_plan() -> dict:
    """Describe what will be flushed without doing it."""
    mongo_collections = ["devices", "device_configurations", "cdp_neighbors", "topology_cache"]

    disk_paths = []
    for subdir in ["goldenState/", "configDrift/", "cdp_output/", "facts/", "runningConfigs/"]:
        path = PLAYBOOKS_DIR / subdir
        if path.exists():
            count = len([f for f in path.iterdir() if f.is_file()]) if path.exists() else 0
            label = f"{subdir} ({count} files)" if count else f"{subdir} (empty)"
            disk_paths.append(label)

    return {
        "mongo_collections": mongo_collections,
        "disk_paths": disk_paths,
    }


def detect_setup_status() -> dict:
    """Check whether the system has been configured or is still on demo data."""
    if not HOSTS_INI_PATH.exists():
        return {
            "setup_complete": False,
            "is_demo": False,
            "device_count": 0,
            "message": "No inventory file found — run the setup wizard to configure your network",
        }

    content = HOSTS_INI_PATH.read_text(encoding="utf-8")
    is_demo = any(pattern in content for pattern in DEMO_IP_PATTERNS)

    device_count = 0
    for line in content.splitlines():
        stripped = line.strip()
        if stripped and not stripped.startswith("#") and not stripped.startswith(";") and not stripped.startswith("[") and "ansible_host=" in stripped:
            device_count += 1

    if is_demo:
        message = f"Demo inventory detected with {device_count} devices — run the setup wizard to configure your network"
    elif device_count > 0:
        message = f"Inventory configured with {device_count} devices"
    else:
        message = "Inventory exists but appears empty"

    return {
        "setup_complete": not is_demo,
        "is_demo": is_demo,
        "device_count": device_count,
        "message": message,
    }


async def init_super_admin(username: str, password: str, email: str, full_name: str) -> dict:
    """Create the first Super Admin user. Rejects if users already exist."""
    from app.database import users_collection
    from passlib.context import CryptContext

    existing_count = await users_collection.count_documents({})
    if existing_count > 0:
        return {
            "status": "skipped",
            "message": f"Users already exist ({existing_count} found) — first admin already created",
        }

    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    hashed = pwd_context.hash(password)

    user_doc = {
        "username": username.lower(),
        "password": hashed,
        "email": email,
        "full_name": full_name,
        "role": "Super Admin",
        "recent_activities": [
            {"event": "Account Created via Setup Wizard", "timestamp": datetime.utcnow().isoformat() + "Z", "type": "info"},
        ],
    }

    await users_collection.insert_one(user_doc)
    return {
        "status": "created",
        "message": f"Super Admin '{username}' created successfully",
    }


async def init_collections_and_indexes() -> dict:
    """Ensure all required MongoDB collections and indexes exist."""
    from app.database import db

    COLLECTIONS = [
        "devices", "logs", "device_configurations", "api_keys",
        "playbooks", "conversations", "syslog_alerts", "users",
        "audit_logs", "cdp_neighbors", "topology_cache",
    ]

    INDEXES = {
        "users": [("username",), ("email",)],
        "conversations": [("session_id",)],
        "audit_logs": [("timestamp",), ("username",)],
        "syslog_alerts": [("timestamp",)],
        "devices": [("hostname",), ("ip",)],
    }

    existing = await db.list_collection_names()
    created = []
    for name in COLLECTIONS:
        if name not in existing:
            await db.create_collection(name)
            created.append(name)

    indexes_created = []
    for col_name, fields in INDEXES.items():
        col = db.get_collection(col_name)
        for field_tuple in fields:
            index_name = f"{'_'.join(field_tuple)}_1"
            existing_indexes = await col.index_information()
            if index_name not in existing_indexes:
                await col.create_index([(f, 1) for f in field_tuple])
                indexes_created.append(f"{col_name}.{'_'.join(field_tuple)}")

    return {
        "status": "success",
        "collections_created": created,
        "indexes_created": indexes_created,
    }


def generate_jwt_secret() -> dict:
    """Generate a random JWT secret and write it to the .env file."""
    import secrets

    secret = secrets.token_hex(32)
    env_path = BASE_DIR / ".env"

    if not env_path.exists():
        return {"status": "error", "message": ".env file not found"}

    content = env_path.read_text(encoding="utf-8")
    if "SECRET_KEY=" in content:
        lines = content.splitlines()
        new_lines = []
        replaced = False
        for line in lines:
            if line.startswith("SECRET_KEY="):
                new_lines.append(f"SECRET_KEY={secret}")
                replaced = True
            else:
                new_lines.append(line)
        if not replaced:
            new_lines.append(f"SECRET_KEY={secret}")
        env_path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
    else:
        with env_path.open("a", encoding="utf-8") as f:
            f.write(f"\nSECRET_KEY={secret}\n")

    return {
        "status": "generated",
        "secret_key": secret,
        "message": "JWT secret generated and saved to .env",
    }
