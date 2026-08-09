import asyncio
import contextlib

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, status
from datetime import datetime

from app.models.telemetry import (
    DeviceConfiguration, DeviceConfigurationRequest, DeviceConfigurationResponse,
    NetworkTerminalCommand, NetworkTerminalResponse,
)
from app.database import device_configurations_collection
from app.routes.network_utils import (
    find_device, load_hosts_ini_credentials, build_prompt, build_terminal_output,
)

router = APIRouter(prefix="/api/network", tags=["Network Terminal"])


@router.post("/devices/{device_id}/configure", response_model=DeviceConfigurationResponse)
async def configure_network_device(device_id: str, request: DeviceConfigurationRequest):
    device = await find_device(device_id)
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found.")
    configuration = {
        "device_id": device["id"], "device_name": device["name"],
        "ssh_port": request.ssh_port, "username": request.username.strip(),
        "auth_method": request.auth_method, "interface_name": request.interface_name.strip(),
        "vlan_id": request.vlan_id.strip(), "management_ip": request.management_ip or device["ip"],
        "subnet_mask": request.subnet_mask.strip(), "gateway": request.gateway,
        "snmp_community": request.snmp_community, "syslog_server": request.syslog_server,
        "ntp_server": request.ntp_server, "notes": request.notes, "saved_at": datetime.utcnow(),
    }
    stored_configuration = dict(configuration)
    if request.password:
        stored_configuration["ssh_password"] = request.password
    if request.enable_password:
        stored_configuration["enable_password"] = request.enable_password
    await device_configurations_collection.update_one(
        {"device_id": device["id"]}, {"$set": stored_configuration}, upsert=True,
    )
    return DeviceConfigurationResponse(
        status="success", message=f"Configuration saved for {device['name']}.",
        configuration=DeviceConfiguration(**configuration),
    )


@router.get("/devices/{device_id}/configuration", response_model=DeviceConfiguration)
async def get_network_device_configuration(device_id: str):
    configuration = await device_configurations_collection.find_one({"device_id": device_id})
    if not configuration:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No saved configuration found for this device.")
    configuration.pop("_id", None)
    return DeviceConfiguration(**configuration)


@router.post("/devices/{device_id}/terminal-command", response_model=NetworkTerminalResponse)
async def run_network_terminal_command(device_id: str, request: NetworkTerminalCommand):
    device = await find_device(device_id)
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found.")
    if not device.get("online", False):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Device is offline.")
    command = request.command.strip()
    prompt = build_prompt(device)
    output = "" if not command else build_terminal_output(device, command)
    return NetworkTerminalResponse(device_id=device["id"], prompt=prompt, command=command, output=output)


@router.websocket("/devices/{device_id}/terminal/ws")
async def network_terminal_ws(websocket: WebSocket, device_id: str):
    await websocket.accept()
    try:
        import asyncssh
    except ImportError:
        await websocket.send_text("SSH support is not installed on the backend.\r\n")
        await websocket.close(code=1011)
        return
    device = await find_device(device_id)
    if not device:
        await websocket.send_text("Device not found.\r\n")
        await websocket.close(code=1008)
        return
    if not device.get("online", False):
        await websocket.send_text("Device is offline.\r\n")
        await websocket.close(code=1008)
        return
    saved_config = await device_configurations_collection.find_one({"device_id": device["id"]}) or {}
    username = saved_config.get("username") or "admin"
    password = saved_config.get("ssh_password")
    ssh_port = int(saved_config.get("ssh_port") or 22)
    if not password:
        hosts_creds = load_hosts_ini_credentials()
        username = hosts_creds.get("username", username)
        password = hosts_creds.get("password")
    if not password:
        await websocket.send_text("Missing SSH password. Open Edit, save SSH credentials.\r\n")
        await websocket.close(code=1008)
        return
    await websocket.send_text(f"Opening SSH session to {username}@{device['ip']}:{ssh_port}...\r\n")
    conn = None
    process = None
    reader_task = None
    receiver_task = None

    async def stream_reader(reader):
        try:
            while True:
                chunk = await reader.read(4096)
                if not chunk:
                    break
                await websocket.send_text(chunk)
        except Exception:
            with contextlib.suppress(Exception):
                await websocket.close()

    async def socket_receiver():
        try:
            while True:
                message = await websocket.receive_text()
                if process and process.stdin:
                    process.stdin.write(message)
                    drain = getattr(process.stdin, "drain", None)
                    if drain:
                        await drain()
        except WebSocketDisconnect:
            pass

    try:
        conn = await asyncssh.connect(
            device["ip"], port=ssh_port, username=username, password=password,
            known_hosts=None,
            kex_algs=["diffie-hellman-group1-sha1", "curve25519-sha256", "curve25519-sha256@libssh.org",
                      "ecdh-sha2-nistp256", "ecdh-sha2-nistp384", "ecdh-sha2-nistp521",
                      "diffie-hellman-group-exchange-sha256", "diffie-hellman-group14-sha256",
                      "diffie-hellman-group15-sha512", "diffie-hellman-group16-sha512",
                      "diffie-hellman-group17-sha512", "diffie-hellman-group18-sha512",
                      "diffie-hellman-group14-sha1"],
            encryption_algs=["aes128-cbc", "aes192-cbc", "aes256-cbc", "aes128-ctr", "aes192-ctr",
                             "aes256-ctr", "aes128-gcm@openssh.com", "aes256-gcm@openssh.com",
                             "chacha20-poly1305@openssh.com"],
            mac_algs=["hmac-sha1", "hmac-sha1-96", "hmac-md5", "hmac-md5-96", "hmac-sha2-256", "hmac-sha2-512"],
            server_host_key_algs=["ssh-rsa", "rsa-sha2-256", "rsa-sha2-512", "ecdsa-sha2-nistp256",
                                  "ecdsa-sha2-nistp384", "ecdsa-sha2-nistp521", "ssh-ed25519"],
        )
        process = await conn.create_process(term_type="xterm", term_size=(120, 34))
        await websocket.send_text("SSH authenticated. Interactive shell ready.\r\n")
        reader_task = asyncio.create_task(stream_reader(process.stdout))
        receiver_task = asyncio.create_task(socket_receiver())
        await asyncio.wait({reader_task, receiver_task}, return_when=asyncio.FIRST_COMPLETED)
    except Exception as exc:
        await websocket.send_text(f"SSH session failed: {exc}\r\n")
    finally:
        for task in (reader_task, receiver_task):
            if task:
                task.cancel()
        if process:
            with contextlib.suppress(Exception):
                process.stdin.write("exit\n")
                process.stdin.write_eof()
        if conn:
            conn.close()
            with contextlib.suppress(Exception):
                await conn.wait_closed()
        with contextlib.suppress(Exception):
            await websocket.close()
