import asyncio
import fcntl
import json
import os
import pty
import signal
import struct
import termios
from pathlib import Path

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

PLAYBOOKS_DIR = Path(__file__).resolve().parent.parent.parent / "playbooks"


def _set_raw_mode(fd: int):
    t = termios.tcgetattr(fd)
    t[0] = t[0] & ~(
        termios.IGNBRK | termios.BRKINT | termios.PARMRK
        | termios.ISTRIP | termios.INLCR | termios.IGNCR
        | termios.ICRNL | termios.IXON
    )
    t[1] = t[1] & ~termios.OPOST
    t[2] = t[2] & ~(termios.CS7 | termios.PARENB | termios.HUPCL)
    t[3] = t[3] & ~(
        termios.ECHO | termios.ECHONL | termios.ICANON
        | termios.ISIG | termios.IEXTEN
    )
    termios.tcsetattr(fd, termios.TCSANOW, t)


def _set_window_size(fd: int, cols: int, rows: int):
    buf = struct.pack("HHHH", rows, cols, 0, 0)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, buf)


@router.websocket("/console/ws")
async def console_websocket(websocket: WebSocket):
    await websocket.accept()

    master_fd, slave_fd = pty.openpty()
    _set_raw_mode(slave_fd)
    _set_window_size(master_fd, 80, 24)

    pid = os.fork()
    if pid == 0:
        os.setsid()
        os.dup2(slave_fd, 0)
        os.dup2(slave_fd, 1)
        os.dup2(slave_fd, 2)
        for fd in range(3, 256):
            try:
                os.close(fd)
            except OSError:
                pass
        os.execvp("podman", [
            "podman", "run", "--rm", "-i", "-t",
            "--network=host",
            "--cap-add=NET_RAW",
            "-v", f"{PLAYBOOKS_DIR}:/ansible:Z",
            "localhost/sentry-ansible", "bash",
        ])
        os._exit(1)

    os.close(slave_fd)

    loop = asyncio.get_event_loop()
    done = False

    def _read_master():
        nonlocal done
        if done:
            return
        try:
            data = os.read(master_fd, 4096)
            if data:
                fut = asyncio.run_coroutine_threadsafe(
                    websocket.send_text(data.decode("utf-8", errors="replace")),
                    loop,
                )
            else:
                done = True
                asyncio.run_coroutine_threadsafe(websocket.close(), loop)
        except Exception:
            done = True
            asyncio.run_coroutine_threadsafe(websocket.close(), loop)

    loop.add_reader(master_fd, _read_master)

    try:
        while not done:
            try:
                message = await websocket.receive_text()
            except WebSocketDisconnect:
                break
            if done:
                break
            try:
                msg = json.loads(message)
                if msg.get("type") == "resize":
                    _set_window_size(
                        master_fd,
                        msg.get("cols", 80),
                        msg.get("rows", 24),
                    )
                    continue
            except (json.JSONDecodeError, TypeError):
                pass
            try:
                os.write(master_fd, message.encode())
            except OSError:
                break
    except WebSocketDisconnect:
        pass
    finally:
        done = True
        loop.remove_reader(master_fd)
        os.close(master_fd)
        try:
            os.kill(pid, signal.SIGKILL)
            os.waitpid(pid, 0)
        except OSError:
            pass
