import os
import json
import logging
import subprocess
import platform
from pathlib import Path
from typing import List, Tuple, Generator, Optional
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).parent.parent.parent
PLAYBOOKS_DIR = BASE_DIR / "playbooks"
PODMAN_CONTAINER_IMAGE = "localhost/sentry-ansible"
PODMAN_ANSIBLE_DIR = "/ansible"


def get_podman_command(playbook_name: str, extra_vars: Optional[dict] = None) -> List[str]:
    system = platform.system()
    playbooks_abs_path = PLAYBOOKS_DIR.resolve()
    cmd = ["podman", "run", "--rm", "--pull=never"]
    if system == "Linux":
        cmd.append("--network=host")
    vol_flag = f"{playbooks_abs_path}:{PODMAN_ANSIBLE_DIR}:Z" if system == "Linux" else f"{playbooks_abs_path}:{PODMAN_ANSIBLE_DIR}"
    cmd.extend(["-v", vol_flag])
    cmd.append(PODMAN_CONTAINER_IMAGE)
    cmd.extend(["ansible-playbook", f"{PODMAN_ANSIBLE_DIR}/{playbook_name}",
                "-i", f"{PODMAN_ANSIBLE_DIR}/hosts.ini"])
    if extra_vars:
        cmd.extend(["--extra-vars", json.dumps(extra_vars)])
    logger.debug(f"Podman command: {' '.join(cmd)}")
    return cmd


def _build_podman_command(extra_args: List[str], scripts_mount: bool = False) -> List[str]:
    system = platform.system()
    playbooks_abs_path = PLAYBOOKS_DIR.resolve()
    cmd = ["podman", "run", "--rm", "--pull=never"]
    if system == "Linux":
        cmd.append("--network=host")
    vol_pb = f"{playbooks_abs_path}:{PODMAN_ANSIBLE_DIR}:Z" if system == "Linux" else f"{playbooks_abs_path}:{PODMAN_ANSIBLE_DIR}"
    cmd.extend(["-v", vol_pb])
    if scripts_mount:
        scripts_abs_path = (BASE_DIR / "scripts").resolve()
        vol_scripts = f"{scripts_abs_path}:/scripts:Z" if system == "Linux" else f"{scripts_abs_path}:/scripts"
        cmd.extend(["-v", vol_scripts])
    cmd.append(PODMAN_CONTAINER_IMAGE)
    cmd.extend(extra_args)
    return cmd


def _run_podman(cmd: List[str], timeout: int = 300) -> Tuple[int, str]:
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return result.returncode, result.stdout + result.stderr
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=status.HTTP_408_REQUEST_TIMEOUT, detail="Podman execution timeout (300s)")
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Podman not found. Ensure Podman is installed and in PATH")


def validate_playbook_path(playbook_name: str) -> Path:
    playbook_path = PLAYBOOKS_DIR / playbook_name
    if not playbook_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Playbook '{playbook_name}' not found")
    if not playbook_name.endswith(('.yml', '.yaml')):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only .yml and .yaml files are allowed")
    return playbook_path


def run_playbook(playbook_name: str, extra_vars: Optional[dict] = None) -> Tuple[int, str]:
    validate_playbook_path(playbook_name)
    cmd = get_podman_command(playbook_name, extra_vars)
    return _run_podman(cmd)


def run_playbook_stream_generator(playbook_name: str) -> Generator[str, None, None]:
    validate_playbook_path(playbook_name)
    try:
        cmd = get_podman_command(playbook_name)
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
        for line in iter(process.stdout.readline, ''):
            if line:
                event_data = json.dumps({"type": "output", "line": line.rstrip('\n')})
                yield f"data: {event_data}\n\n"
        returncode = process.wait()
        completion_data = json.dumps({
            "type": "complete",
            "status": "success" if returncode == 0 else "failed",
            "returncode": returncode
        })
        yield f"data: {completion_data}\n\n"
    except FileNotFoundError:
        error_data = json.dumps({"type": "error", "message": "Podman not found. Ensure Podman is installed and in PATH"})
        yield f"data: {error_data}\n\n"
    except Exception as e:
        error_data = json.dumps({"type": "error", "message": str(e)})
        yield f"data: {error_data}\n\n"


def run_drift_analysis() -> Tuple[int, str]:
    cmd = _build_podman_command(["/bin/bash", f"{PODMAN_ANSIBLE_DIR}/run_action.sh", "drift"], scripts_mount=True)
    logger.debug(f"Running drift analysis command: {' '.join(cmd)}")
    return _run_podman(cmd)


def run_baseline_collection() -> Tuple[int, str]:
    cmd = _build_podman_command(["/bin/bash", f"{PODMAN_ANSIBLE_DIR}/run_action.sh", "collect"])
    logger.debug(f"Running baseline collection command: {' '.join(cmd)}")
    return _run_podman(cmd)


def run_baseline_refresh() -> Tuple[int, str]:
    cmd = _build_podman_command(["/bin/bash", f"{PODMAN_ANSIBLE_DIR}/run_action.sh", "refresh"], scripts_mount=True)
    logger.debug(f"Running baseline refresh command: {' '.join(cmd)}")
    return _run_podman(cmd)


def save_playbook_file(filename: str, content: bytes) -> str:
    filepath = PLAYBOOKS_DIR / filename
    if filepath.exists():
        stem = filepath.stem
        suffix = filepath.suffix
        counter = 1
        while filepath.exists():
            filepath = PLAYBOOKS_DIR / f"{stem}_{counter}{suffix}"
            counter += 1
    try:
        filepath.write_bytes(content)
        return filepath.name
    except Exception as e:
        logger.error(f"Error saving playbook file: {str(e)}")
        raise


def read_playbook_file(filename: str) -> str:
    filepath = PLAYBOOKS_DIR / filename
    if not filepath.exists():
        return None
    try:
        return filepath.read_text(encoding='utf-8')
    except Exception as e:
        logger.error(f"Error reading playbook file {filename}: {str(e)}")
        return None


def delete_playbook_file(filename: str) -> bool:
    filepath = PLAYBOOKS_DIR / filename
    if not filepath.exists():
        return False
    try:
        filepath.unlink()
        return True
    except Exception as e:
        logger.error(f"Error deleting playbook file {filename}: {str(e)}")
        return False


def read_playbook_content(filename: str) -> str:
    content = read_playbook_file(filename)
    if content is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Playbook '{filename}' not found"
        )
    return content
