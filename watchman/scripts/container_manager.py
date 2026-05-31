#!/usr/bin/env python3
"""
Cross-platform Podman container manager for Sentry-Pod Ansible playbooks.

This script helps build and manage the sentry-ansible container for running playbooks
on both Windows and Linux systems.

Usage:
    python container_manager.py build          # Build the Ansible container
    python container_manager.py run <playbook> # Run a playbook inside the container
    python container_manager.py shell          # Open an interactive shell in the container
    python container_manager.py check          # Check if Podman is installed and container exists
"""

import subprocess
import sys
import os
import argparse
import platform
from pathlib import Path


class PodmanContainerManager:
    def __init__(self, container_name="sentry-ansible"):
        self.container_name = container_name
        self.script_dir = Path(__file__).parent
        self.repo_root = self.script_dir.parent.parent
        self.dockerfile_path = self.script_dir.parent / "Dockerfile.ansible"
        self.playbooks_dir = self.repo_root / "watchman" / "playbooks"
        self.system = platform.system()
        
    def check_podman_installed(self) -> bool:
        """Check if Podman is installed."""
        try:
            subprocess.run(
                ["podman", "--version"],
                capture_output=True,
                check=True,
                text=True
            )
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            return False
    
    def check_container_exists(self) -> bool:
        """Check if the container image already exists."""
        try:
            result = subprocess.run(
                ["podman", "image", "exists", self.container_name],
                capture_output=True
            )
            return result.returncode == 0
        except FileNotFoundError:
            return False
    
    def build_container(self) -> bool:
        """Build the Ansible container image."""
        if not self.check_podman_installed():
            print("❌ Error: Podman is not installed or not in PATH")
            print("Please install Podman from https://podman.io/docs/installation")
            return False
        
        if not self.dockerfile_path.exists():
            print(f"❌ Error: Dockerfile not found at {self.dockerfile_path}")
            return False
        
        print(f"🔨 Building container image '{self.container_name}'...")
        try:
            subprocess.run(
                [
                    "podman", "build",
                    "-f", str(self.dockerfile_path),
                    "-t", self.container_name,
                    str(self.repo_root / "watchman")
                ],
                check=True
            )
            print(f"✅ Container '{self.container_name}' built successfully!")
            return True
        except subprocess.CalledProcessError as e:
            print(f"❌ Failed to build container: {e}")
            return False
    
    def run_playbook(self, playbook_name: str, inventory_file: str = "hosts.ini") -> bool:
        """Run a playbook inside the container."""
        if not self.check_podman_installed():
            print("❌ Error: Podman is not installed or not in PATH")
            return False
        
        if not self.check_container_exists():
            print(f"❌ Error: Container '{self.container_name}' does not exist")
            print("Run: python container_manager.py build")
            return False
        
        if not (self.playbooks_dir / playbook_name).exists():
            print(f"❌ Error: Playbook '{playbook_name}' not found in {self.playbooks_dir}")
            return False
        
        playbooks_abs_path = self.playbooks_dir.resolve()
        
        cmd = [
            "podman", "run", "--rm", "-it",
            "--network=host" if self.system == "Linux" else None,
            "-v", f"{playbooks_abs_path}:/ansible:Z",
            self.container_name,
            "ansible-playbook", f"/ansible/{playbook_name}",
            "-i", f"/ansible/{inventory_file}"
        ]
        
        # Remove None values
        cmd = [c for c in cmd if c is not None]
        
        print(f"🚀 Running playbook '{playbook_name}' in container...")
        try:
            subprocess.run(cmd, check=False)
            return True
        except Exception as e:
            print(f"❌ Error running playbook: {e}")
            return False
    
    def open_shell(self) -> bool:
        """Open an interactive shell in the container."""
        if not self.check_podman_installed():
            print("❌ Error: Podman is not installed or not in PATH")
            return False
        
        if not self.check_container_exists():
            print(f"❌ Error: Container '{self.container_name}' does not exist")
            print("Run: python container_manager.py build")
            return False
        
        playbooks_abs_path = self.playbooks_dir.resolve()
        
        cmd = [
            "podman", "run", "--rm", "-it",
            "--network=host" if self.system == "Linux" else None,
            "-v", f"{playbooks_abs_path}:/ansible:Z",
            self.container_name,
            "bash"
        ]
        
        # Remove None values
        cmd = [c for c in cmd if c is not None]
        
        print(f"🐚 Opening interactive shell in '{self.container_name}' container...")
        print(f"📁 Playbooks mounted at: /ansible")
        try:
            subprocess.run(cmd, check=False)
            return True
        except Exception as e:
            print(f"❌ Error opening shell: {e}")
            return False
    
    def check_status(self) -> None:
        """Check the status of Podman and the container."""
        print("📊 Sentry-Pod Container Status")
        print("-" * 50)
        
        # Check Podman
        if self.check_podman_installed():
            result = subprocess.run(
                ["podman", "--version"],
                capture_output=True,
                text=True
            )
            print(f"✅ Podman: {result.stdout.strip()}")
        else:
            print("❌ Podman: Not installed or not in PATH")
            print("   Install from: https://podman.io/docs/installation")
            return
        
        # Check container image
        if self.check_container_exists():
            print(f"✅ Container Image: '{self.container_name}' exists")
        else:
            print(f"❌ Container Image: '{self.container_name}' not found")
            print(f"   Build it with: python container_manager.py build")
        
        # Check playbooks directory
        if self.playbooks_dir.exists():
            playbook_count = len(list(self.playbooks_dir.glob("*.yml"))) + \
                           len(list(self.playbooks_dir.glob("*.yaml")))
            print(f"✅ Playbooks Directory: {self.playbooks_dir} ({playbook_count} playbooks)")
        else:
            print(f"❌ Playbooks Directory: Not found at {self.playbooks_dir}")
        
        print("-" * 50)


def main():
    parser = argparse.ArgumentParser(
        description="Manage Podman container for Sentry-Pod Ansible playbooks"
    )
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")
    
    # Build command
    subparsers.add_parser("build", help="Build the Ansible container image")
    
    # Run command
    run_parser = subparsers.add_parser("run", help="Run a playbook in the container")
    run_parser.add_argument("playbook", help="Playbook filename (e.g., get_facts.yml)")
    run_parser.add_argument("-i", "--inventory", default="hosts.ini", 
                          help="Inventory file (default: hosts.ini)")
    
    # Shell command
    subparsers.add_parser("shell", help="Open interactive shell in the container")
    
    # Check command
    subparsers.add_parser("check", help="Check Podman and container status")
    
    args = parser.parse_args()
    
    manager = PodmanContainerManager()
    
    if args.command == "build":
        success = manager.build_container()
        sys.exit(0 if success else 1)
    
    elif args.command == "run":
        success = manager.run_playbook(args.playbook, args.inventory)
        sys.exit(0 if success else 1)
    
    elif args.command == "shell":
        success = manager.open_shell()
        sys.exit(0 if success else 1)
    
    elif args.command == "check":
        manager.check_status()
        sys.exit(0)
    
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
