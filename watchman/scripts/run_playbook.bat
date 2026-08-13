@echo off
REM Cross-platform Podman wrapper for running Ansible playbooks
REM Works on Windows with Podman
REM Usage: run_playbook.bat [playbook_name] [inventory_file]

setlocal enabledelayedexpansion

REM Get the script directory
set SCRIPT_DIR=%~dp0
REM Navigate to repo root (watchman/scripts -> watchman -> repo_root)
cd /d "%SCRIPT_DIR%..\..\"
set REPO_ROOT=%cd%
set WATCHMAN_DIR=%REPO_ROOT%\watchman
set PLAYBOOKS_DIR=%WATCHMAN_DIR%\playbooks
set CONTAINER_NAME=sentry-ansible

REM Get arguments
set PLAYBOOK=%1
if "!PLAYBOOK!"=="" set PLAYBOOK=collect_facts.yml

set INVENTORY=%2
if "!INVENTORY!"=="" set INVENTORY=hosts.ini

REM Check if Podman is installed
where podman >nul 2>nul
if errorlevel 1 (
    echo ❌ Error: Podman is not installed or not in PATH
    echo Install Podman from: https://podman.io/docs/installation
    exit /b 1
)

REM Check if container exists
podman image exists %CONTAINER_NAME% >nul 2>&1
if errorlevel 1 (
    echo ❌ Error: Container '%CONTAINER_NAME%' does not exist
    echo Build it with: python scripts\container_manager.py build
    exit /b 1
)

REM Check if playbook exists
if not exist "%PLAYBOOKS_DIR%\!PLAYBOOK!" (
    echo ❌ Error: Playbook '!PLAYBOOK!' not found in %PLAYBOOKS_DIR%
    exit /b 1
)

REM Run the playbook
echo 🚀 Running playbook '!PLAYBOOK!' in container...
cd /d "%PLAYBOOKS_DIR%"
podman run --rm -it ^
    -v "%PLAYBOOKS_DIR%:/ansible" ^
    %CONTAINER_NAME% ^
    ansible-playbook "/ansible/!PLAYBOOK!" -i "/ansible/!INVENTORY!"

endlocal
