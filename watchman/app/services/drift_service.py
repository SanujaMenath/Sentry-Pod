import re
import logging
from pathlib import Path
from typing import List, Tuple, Optional

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).parent.parent.parent
PLAYBOOKS_DIR = BASE_DIR / "playbooks"
ANSI_ESCAPE = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')


def _strip_ansi(text: str) -> str:
    return ANSI_ESCAPE.sub('', text)


def parse_config_drift_reports() -> List[dict]:
    drift_dir = PLAYBOOKS_DIR / "configDrift"
    results: List[dict] = []
    if not drift_dir.exists() or not drift_dir.is_dir():
        return results
    for path in sorted(drift_dir.glob('DRIFT_*.diff')):
        try:
            hostname = path.name.replace('DRIFT_', '').replace('.diff', '')
            text = path.read_text(encoding='utf-8', errors='ignore')
            text = _strip_ansi(text)
            lines = text.splitlines()
            additions = []
            removals = []
            for ln in lines:
                if ln.startswith('+++') or ln.startswith('---'):
                    continue
                if ln.startswith('+') and not ln.startswith('++'):
                    additions.append(ln[1:].strip())
                elif ln.startswith('-') and not ln.startswith('--'):
                    removals.append(ln[1:].strip())
            summary = None
            if additions or removals:
                summary = {"added": len(additions), "removed": len(removals)}
            results.append({
                "hostname": hostname,
                "path": str(path.relative_to(BASE_DIR)),
                "mtime": int(path.stat().st_mtime),
                "diff_content": text,
                "additions": additions,
                "removals": removals,
                "summary": summary,
            })
        except Exception:
            continue
    return results


def read_config_drift_file(hostname: str) -> str:
    drift_dir = PLAYBOOKS_DIR / "configDrift"
    target = drift_dir / f"DRIFT_{hostname}.diff"
    if not target.exists():
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Drift report not found")
    try:
        text = target.read_text(encoding='utf-8', errors='ignore')
        return _strip_ansi(text)
    except Exception as e:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


def get_baselined_devices() -> List[str]:
    golden_dir = PLAYBOOKS_DIR / "goldenState"
    devices = []
    if golden_dir.exists() and golden_dir.is_dir():
        for path in golden_dir.glob("GS_*.txt"):
            hostname = path.name.replace("GS_", "").replace(".txt", "")
            devices.append(hostname)
    return sorted(devices)
