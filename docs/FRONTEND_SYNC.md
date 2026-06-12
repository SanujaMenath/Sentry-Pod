# Frontend Source Sync (frontend → command-center)

## Overview

Development happens in `frontend/` (host-based `npm run dev` with hot-reload). The production container (`command-center`) is built from a separate copy of the source under `command-center/src/`. Over time these copies drifted — the container was shipping stale code. An automatic `shutil.copytree` step mirrors `frontend/src/` → `command-center/src/` before every container build, keeping them identical with zero manual overhead. Uses only Python stdlib — no system dependencies.

## What Changed

### Modified
- `watchman/scripts/container_manager.py` (lines 123-144) — added `_sync_frontend_to_command_center()` method and calls it before `command-center` compose builds

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   container_manager.py                      │
│                                                             │
│  build command-center                                       │
│       │                                                     │
│       ├── copytree(frontend/src, command-center/src)        │
│       └── podman-compose build command-center               │
│                                                             │
│  build all                                                  │
│       │                                                     │
│       ├── build ansible                                     │
│       ├── copytree(frontend/src, command-center/src)        │
│       └── podman-compose build                              │
└─────────────────────────────────────────────────────────────┘

Development loop:
  ┌──────────────┐     build time     ┌──────────────────┐
  │ frontend/src │  ── copytree ───→  │command-center/src│
  │ (canonical)  │                    │  (mirror)        │
  └──────────────┘                    └────────┬─────────┘
                                               │
                                               ▼
                                        nginx container
                                        (fresh-command-center)
```

## File-by-File Detail

### 1. `watchman/scripts/container_manager.py`

Added `_sync_frontend_to_command_center()`:

```python
def _sync_frontend_to_command_center(self):
    import shutil
    src = self.repo_root / "frontend" / "src"
    dst = self.repo_root / "command-center" / "src"
    print(f"Syncing {src} → {dst} ...")
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst)
```

Called before `command-center` builds in two paths:

| Entry point | Sync triggers |
|---|---|
| `build all` | ✅ fires before compose build |
| `build command-center` | ✅ fires before single-service build |
| `build watchman` / `build syslog-ng` / `build ansible` | ❌ skipped (unnecessary) |

Uses `rmtree` + `copytree` so only the *contents* of `frontend/src/` are mirrored, not the directory itself.

## Data Flow

```
Developer                               container_manager.py
    │                                            │
    │  edits frontend/src/*.jsx                  │
    │  (hot-reload via npm run dev)              │
    │                                            │
    │  ready to ship                             │
    │                                            │
    │── python container_manager.py ────────────→│
    │   build command-center                     │
    │                                            │
    │                  copytree                  │
    │                   frontend/src/            │
    │                         ↓                  │
    │                  command-center/src/       │
    │                                            │
    │                  podman-compose build      │
    │                         ↓                  │
    │                  docker build reads        │
    │                  command-center/dist/      │
    │                         ↓                  │
    │                 nginx:alpine image         │
    │                 (fresh-command-center)     │
    │                                            │
    │←── built successfully ─────────────────────│
```

## Usage

### Standard workflow

```bash
# 1. Develop in frontend/ (hot-reload)
cd frontend && npm run dev

# 2. When ready to containerize — the sync is automatic
python watchman/scripts/container_manager.py build command-center

# Or build everything (also includes sync)
python watchman/scripts/container_manager.py build all
```

### Manual sync (optional)

If you want to sync without building:

```bash
python -c "
import shutil, pathlib
src = pathlib.Path('frontend/src')
dst = pathlib.Path('command-center/src')
if dst.exists(): shutil.rmtree(dst)
shutil.copytree(src, dst)
"

### Verify drift

```bash
diff -rq frontend/src command-center/src
```

## Design Notes

- **Why `shutil.copytree` over a monorepo approach?** The project is still in active development. Restructuring into npm workspaces would create build context complications (Docker needs parent directory access, `node_modules` resolution changes) worth tackling only when the codebase stabilizes. `shutil.copytree` solves the immediate problem with zero architectural debt and zero system dependencies.

- **Why `shutil.copytree` over `rsync`?** `rsync` is not available on Windows without WSL/Cygwin. Using Python's stdlib `shutil` works identically on Linux, macOS, and Windows with no extra installation — critical for cross-platform support via Podman Desktop.

- **Why not symlinks?** Symlinks would be ideal for dev convenience, but Docker's `COPY` follows symlinks to the real files. Since the Docker build copies `dist/` (not `src/`), and the build is done via compose which uses `command-center/` as its context, symlinks would require restructuring the Dockerfile and compose context — the same complexity as a monorepo approach.

- **What about intentionally divergent files?** Previously `NetworkDevices.jsx` had drifted (frontend had terminal/SSH features that the production build was missing). This was unintentional — the drift was a regression, not a deliberate fork. The sync restores the intended behavior where the production build matches the dev source.

- **Sync direction is one-way:** `frontend/` is the canonical source. Never edit `command-center/src/` directly — changes will be overwritten on the next sync.
