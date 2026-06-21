#!/usr/bin/env python3
"""
Cross-platform Podman container manager for Sentry-Pod.

Single entry point for building and managing all project containers
on Linux and Windows (Podman Desktop).

Usage:
    python container_manager.py build [all|watchman|syslog-ng|command-center|ansible]
    python container_manager.py up
    python container_manager.py down
    python container_manager.py status
    python container_manager.py run <playbook> [-i INVENTORY]
    python container_manager.py shell
"""

import argparse
import atexit
import platform
import re
import subprocess
import sys
import tempfile
from pathlib import Path


_temp_files = set()


@atexit.register
def _cleanup_temp_files():
    for p in _temp_files:
        try:
            p.unlink(missing_ok=True)
        except Exception:
            pass


class SentryPodManager:
    COMPOSE_SERVICES = ["watchman", "syslog-ng", "command-center"]
    ALL_TARGETS = ["all", "watchman", "syslog-ng", "command-center", "ansible"]

    def __init__(self):
        self.script_dir = Path(__file__).parent.resolve()
        self.watchman_dir = self.script_dir.parent
        self.repo_root = self.watchman_dir.parent

        self.compose_file = self.repo_root / "podman-compose.yaml"
        self.ansible_dockerfile = self.watchman_dir / "Dockerfile.ansible"
        self.playbooks_dir = self.watchman_dir / "playbooks"

        self.system = platform.system()
        self.is_linux = self.system == "Linux"

    # ------------------------------------------------------------------ #
    #  Utilities
    # ------------------------------------------------------------------ #

    def _check_podman(self):
        if not self._podman_installed():
            print("Error: Podman is not installed or not in PATH")
            print("       Install Podman Desktop from https://podman.io")
            sys.exit(1)

    def _podman_installed(self):
        try:
            subprocess.run(
                ["podman", "--version"], capture_output=True, check=True
            )
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            return False

    def _check_podman_compose(self):
        if not self._podman_compose_installed():
            print("Error: podman-compose is not installed")
            print("       Install it: pip install podman-compose")
            sys.exit(1)

    def _podman_compose_installed(self):
        try:
            subprocess.run(
                ["podman-compose", "--version"], capture_output=True, check=True
            )
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            return False

    def _get_compose_file(self) -> Path:
        if self.is_linux:
            return self.compose_file
        content = self.compose_file.read_text(encoding="utf-8")
        content = re.sub(
            r":[Zz](?=\s*$|\s+#)", "", content, flags=re.MULTILINE
        )
        content = re.sub(
            r'((?:build|context):\s*)\./',
            lambda m: m.group(1) + str(self.repo_root.resolve()).replace("\\", "/") + "/",
            content,
        )
        
        # FIX: Generate the temp file inside the repository root instead of OS Temp folder
        tmp = Path(
            tempfile.mktemp(suffix=".yaml", prefix="sentry-compose-", dir=str(self.repo_root))
        )
        tmp.write_text(content, encoding="utf-8")
        _temp_files.add(tmp)
        return tmp

    def _image_exists(self, name: str) -> bool:
        try:
            r = subprocess.run(
                ["podman", "image", "exists", name], capture_output=True
            )
            return r.returncode == 0
        except FileNotFoundError:
            return False

    def _run_compose(self, *args):
        self._check_podman_compose()
        cf = self._get_compose_file()
        subprocess.run(
            ["podman-compose", "-f", str(cf), *args], 
            check=True,
            cwd=str(self.repo_root) 
        )

    # ------------------------------------------------------------------ #
    #  Build
    # ------------------------------------------------------------------ #

    def build(self, target: str = "all"):
        self._check_podman()
        if target == "all":
            print("Building all containers ...")
            self._build_ansible()
            self._run_compose("build")
            print("All containers built successfully!")
        elif target in self.COMPOSE_SERVICES:
            self._run_compose("build", target)
            print(f"'{target}' built successfully!")
        elif target == "ansible":
            self._build_ansible()

    def _build_ansible(self):
        if not self.ansible_dockerfile.exists():
            print(
                f"Error: Dockerfile not found at {self.ansible_dockerfile}"
            )
            sys.exit(1)
        print("Building sentry-ansible container ...")
        subprocess.run(
            [
                "podman",
                "build",
                "-f",
                str(self.ansible_dockerfile),
                "-t",
                "localhost/sentry-ansible",
                str(self.watchman_dir),
            ],
            check=True,
        )
        # Save image as tar so watchman container can load it for nested podman
        tar_path = self.watchman_dir / "sentry-ansible.tar"
        tar_path.unlink(missing_ok=True)  # podman save -o doesn't overwrite
        print(f"Saving sentry-ansible image to {tar_path} ...")
        subprocess.run(
            ["podman", "save", "-o", str(tar_path), "localhost/sentry-ansible"],
            check=True,
        )
        print("sentry-ansible built and saved successfully!")

    # ------------------------------------------------------------------ #
    #  Compose lifecycle
    # ------------------------------------------------------------------ #

    def up(self):
        self._check_podman()
        print("Starting Sentry-Pod stack ...")
        self._run_compose("up", "-d")
        print("Stack is up!")

    def down(self):
        self._check_podman()
        print("Stopping Sentry-Pod stack ...")
        self._run_compose("down")
        print("Stack stopped.")

    # ------------------------------------------------------------------ #
    #  Ansible run / shell
    # ------------------------------------------------------------------ #

    def run_playbook(
        self, playbook_name: str, inventory_file: str = "hosts.ini"
    ):
        self._check_podman()
        if not self._image_exists("localhost/sentry-ansible"):
            print(
                "Error: sentry-ansible image not found. "
                "Run: python container_manager.py build ansible"
            )
            sys.exit(1)
        pb = self.playbooks_dir / playbook_name
        if not pb.exists():
            print(
                f"Error: Playbook '{playbook_name}' not found "
                f"in {self.playbooks_dir}"
            )
            sys.exit(1)

        vol = (
            f"{self.playbooks_dir}:/ansible:Z"
            if self.is_linux
            else f"{self.playbooks_dir}:/ansible"
        )
        cmd = [
            "podman",
            "run",
            "--rm",
            "-it",
            "-v",
            vol,
            "localhost/sentry-ansible",
            "ansible-playbook",
            "--env-file",
            f"/ansible/{playbook_name}",
            "-i",
            f"/ansible/{inventory_file}",
        ]
        if self.is_linux:
            cmd.insert(4, "--network=host")

        print(f"Running playbook '{playbook_name}' ...")
        subprocess.run(cmd)

    def open_shell(self):
        self._check_podman()
        if not self._image_exists("localhost/sentry-ansible"):
            print(
                "Error: sentry-ansible image not found. "
                "Run: python container_manager.py build ansible"
            )
            sys.exit(1)

        vol = (
            f"{self.playbooks_dir}:/ansible:Z"
            if self.is_linux
            else f"{self.playbooks_dir}:/ansible"
        )
        cmd = [
            "podman",
            "run",
            "--rm",
            "-it",
            "-v",
            vol,
            "localhost/sentry-ansible",
            "bash",
        ]
        if self.is_linux:
            cmd.insert(4, "--network=host")

        print("Opening interactive shell in sentry-ansible container ...")
        subprocess.run(cmd)

    # ------------------------------------------------------------------ #
    #  Status
    # ------------------------------------------------------------------ #

    def status(self):
        print()
        print("Sentry-Pod Status")
        print("-" * 50)

        if not self._podman_installed():
            print("Podman: NOT INSTALLED")
            return

        ver = subprocess.run(
            ["podman", "--version"], capture_output=True, text=True
        )
        print(f"Podman:        {ver.stdout.strip()}")

        if self._podman_compose_installed():
            ver = subprocess.run(
                ["podman-compose", "--version"],
                capture_output=True,
                text=True,
            )
            line = ver.stdout.strip().split("\n")[0]
            print(f"podman-compose: {line}")
        else:
            print("podman-compose: NOT INSTALLED")

        print()
        print("Images:")

        images = [
            ("localhost/sentry-ansible", "Ansible runner"),
            ("localhost/sentry-pod-command-center", "Command Center"),
        ]
        for img, label in images:
            if self._image_exists(img):
                print(f"  [+] {label}")
            else:
                print(f"  [!] {label} — not built")

        print()
        print("Running containers:")

        ps = subprocess.run(
            ["podman", "ps", "--format", "{{.Names}}  ({{.Image}})"],
            capture_output=True,
            text=True,
        )
        if ps.stdout.strip():
            for line in ps.stdout.strip().split("\n"):
                print(f"  {line}")
        else:
            print("  (none)")

        print("-" * 50)

    check = status


# ====================================================================== #
#  CLI
# ====================================================================== #


def main():
    parser = argparse.ArgumentParser(
        description="Cross-platform container manager for Sentry-Pod"
    )
    sub = parser.add_subparsers(dest="command", help="Command")

    # build
    bp = sub.add_parser("build", help="Build one or all container images")
    bp.add_argument(
        "target",
        nargs="?",
        default="all",
        choices=SentryPodManager.ALL_TARGETS,
        help="Which container to build (default: all)",
    )

    # up / down
    sub.add_parser("up", help="Start the full Sentry-Pod stack (podman-compose up)")
    sub.add_parser("down", help="Stop the Sentry-Pod stack")
    sub.add_parser("status", aliases=["check"], help="Show system status")

    # run
    rp = sub.add_parser("run", help="Run a playbook inside the sentry-ansible container")
    rp.add_argument("playbook", help="Playbook filename (e.g. get_facts.yml)")
    rp.add_argument(
        "-i", "--inventory", default="hosts.ini",
        help="Inventory file (default: hosts.ini)",
    )

    # shell
    sub.add_parser("shell", help="Open an interactive shell in sentry-ansible")

    args = parser.parse_args()

    mgr = SentryPodManager()

    if args.command == "build":
        mgr.build(args.target)
    elif args.command == "up":
        mgr.up()
    elif args.command == "down":
        mgr.down()
    elif args.command in ("status", "check"):
        mgr.status()
    elif args.command == "run":
        mgr.run_playbook(args.playbook, args.inventory)
    elif args.command == "shell":
        mgr.open_shell()
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()