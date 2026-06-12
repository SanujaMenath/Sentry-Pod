# Terminal Customization & Web Console

## Overview

Two new capabilities: a full-page **Console** that gives network engineers a browser-based bash terminal inside the `sentry-ansible` container, and a **Terminal Customization** settings panel that controls appearance (font, theme, cursor) independently for SSH device terminals and the Console page. The existing SSH terminal modal was also rewritten from a manual `<pre>`-based implementation to xterm.js for proper ANSI/color support.

## What Changed

### Created

| File | Purpose |
|---|---|
| `watchman/app/routes/console_routes.py` | FastAPI WebSocket endpoint (`/console/ws`) that forks a PTY and execs `podman run --rm -it ... bash` inside sentry-ansible |
| `command-center/src/pages/Console.jsx` | Full-page xterm.js terminal connected to the Console WebSocket |
| `frontend/src/pages/Console.jsx` | Same for the dev frontend |
| `command-center/src/config/terminalThemes.js` | Color scheme definitions (6 schemes, 12 flavors), `resolveTheme()` helper, `DEFAULT_TERMINAL_CONFIG` |
| `frontend/src/config/terminalThemes.js` | Same |
| `command-center/src/hooks/useTerminalConfig.js` | React hook reading/writing `sentry_pod_terminal_config` to localStorage |
| `frontend/src/hooks/useTerminalConfig.js` | Same |
| `command-center/src/components/TerminalConfigCard.jsx` | Tabbed settings card with font, theme, cursor controls + flavor popover |
| `frontend/src/components/TerminalConfigCard.jsx` | Same |

### Modified

| File | Change |
|---|---|
| `watchman/app/main.py` | Registered `console_routes.router` |
| `command-center/src/App.jsx` | Added `/console` route |
| `frontend/src/App.jsx` | Same |
| `command-center/src/components/Sidebar.jsx` | Added Console nav item with Terminal icon |
| `frontend/src/components/Sidebar.jsx` | Same + RBAC permission for `/console` |
| `command-center/src/pages/Settings.jsx` | Added `TerminalConfigCard` as third row |
| `frontend/src/pages/Settings.jsx` | Same |
| `command-center/src/components/TerminalDeviceModal.jsx` | Rewrote from `<pre>`+keydown to xterm.js; consumes `sshConfig` from hook |
| `frontend/src/components/TerminalDeviceModal.jsx` | Same |
| `command-center/src/pages/Console.jsx` | Consumes `consoleConfig` from hook; live theme/font/cursor updates |
| `frontend/src/pages/Console.jsx` | Same |

## Architecture

```
┌─ Browser ─────────────────────────────────────┐
│                                               │
│  Console.jsx ──WebSocket──► /console/ws       │
│  (xterm.js)                │                  │
│                             │ PTY alloc       │
│  TerminalDeviceModal ──WS──► /devices/.../ws  │
│  (xterm.js)                │ asyncssh         │
│                             │                 │
│  Settings ──useTerminalConfig──► localStorage │
│  (TerminalConfigCard)                         │
└───────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  watchman container   │
              │  (privileged)         │
              │                       │
              │  podman run --rm      │
              │  localhost/sentry-    │
              │  ansible bash         │
              │         │             │
              │  asyncssh ──► network │
              │  device SSH session   │
              └───────────────────────┘
```

## File-by-File Detail

### 1. `watchman/app/routes/console_routes.py`

WebSocket handler that:
1. Allocates a PTY pair via `os.openpty()`
2. Configures raw terminal mode on the slave
3. Forks; child calls `os.setsid()`, dup2's slave to 0/1/2, then `exec`s `podman run --rm -i -t -v playbooks:/ansible:Z --network=host localhost/sentry-ansible bash`
4. Parent closes slave, uses `loop.add_reader(master_fd)` to stream PTY output to the WebSocket
5. WebSocket messages are written to the PTY master via `os.write()`
6. Resize messages (`{"type":"resize","cols":80,"rows":24}`) trigger `TIOCSWINSZ` ioctl on the master fd
7. On disconnect: kills the child process (container auto-removed via `--rm`)

Key detail: the podman container inherits the playbooks volume mount, so `cd /ansible && ansible-playbook -i hosts.ini get_facts.yml` works immediately inside the console.

### 2. `config/terminalThemes.js`

Data model:
```js
COLOR_SCHEMES = {
  catppuccin: {
    name: "Catppuccin",
    defaultFlavor: "mocha",
    flavors: {
      mocha: { background, foreground, cursor, black, red, green, ... },
      macchiato: { ... },
      frappe: { ... },
      latte: { ... },
    },
  },
  nord: {
    name: "Nord",
    theme: { ... },  // single variant, no flavor selector
  },
  // ... everforest, gruvbox, tokyo-night, dracula
}
```

Helper functions:
- **`resolveTheme(colorScheme)`** — parses `"catppuccin-mocha"` → `{ schemeKey, flavorKey, flavorName, theme }`. Falls back to `catppuccin.mocha` on unknown scheme.
- **`getSwatchColors(colorScheme)`** — returns `[red, green, yellow, blue]` for the resolved flavor (used in the mini palette preview cards).

Config string format: `"{schemeKey}-{flavorKey}"` (e.g. `"catppuccin-mocha"`, `"everforest-light"`, `"nord"`).

### 3. `hooks/useTerminalConfig.js`

```js
const { sshConfig, consoleConfig, updateSshConfig, updateConsoleConfig } = useTerminalConfig();
```

- Reads from `localStorage` key `sentry_pod_terminal_config` on mount
- Falls back to `DEFAULT_TERMINAL_CONFIG` (Catppuccin Mocha, 14px, block cursor, blink on)
- `updateSshConfig(patch)` and `updateConsoleConfig(patch)` shallow-merge the patch into the existing config and persist to localStorage
- Each returns the full config objects via React state, so all consumers re-render on change

### 4. `components/TerminalConfigCard.jsx`

- Two tabs: **SSH Terminal** | **Console** — each manages its own independent settings
- Controls:
  - **Font Size**: ± buttons, range 10–28
  - **Font Family**: dropdown (JetBrains Mono, Fira Code, Cascadia Code, Monaspace Neon, Monospace)
  - **Color Scheme**: 3×2 grid of scheme cards showing mini palette swatches (red, green, yellow, blue dots). Clicking a scheme with flavors opens a popover; clicking a single-variant scheme selects immediately.
  - **Flavor Popover**: absolute-positioned dropdown inside the scheme card showing each flavor with its background color swatch + name. Active flavor highlighted.
  - **Cursor Style**: three-segment toggle (Block / Underline / Bar)
  - **Cursor Blink**: toggle switch
- All changes apply instantly — no Save button. Changes propagate via the hook to all active terminals.

### 5. `pages/Console.jsx` and `components/TerminalDeviceModal.jsx`

Both create an xterm.js `Terminal` instance with config from the hook:
```js
const { consoleConfig: { fontSize, fontFamily, colorScheme, cursorStyle, cursorBlink } } = useTerminalConfig();
const theme = resolveTheme(colorScheme).theme;
```

Architecture: two effects per component:
1. **Creation effect** (`[]` deps): creates the Terminal, FitAddon, WebSocket, ResizeObserver. Runs once. The eslint `exhaustive-deps` warning is intentionally suppressed — we do NOT want to recreate the terminal on config change.
2. **Config effect** (individual config values as deps): applies `term.options.fontSize`, `term.options.theme`, `term.options.cursorStyle`, etc. immediately. This gives live preview: changing a setting in the Settings tab instantly updates any open terminal.

## Data Flow

### Console page data flow
```
User types in xterm.js
  → term.onData() → WebSocket.send(data)
  → watchman console_routes.py → os.write(master_fd)
  → PTY → podman → bash (inside sentry-ansible container)
  → bash output → PTY → os.read(master_fd)
  → loop.add_reader callback → WebSocket.send_text(data)
  → xterm.js terminal.write()
```

### Settings persistence flow
```
User changes font size in TerminalConfigCard
  → updateConfig({ fontSize: 16 })
  → useTerminalConfig saves to localStorage + triggers re-render
  → Console.jsx / TerminalDeviceModal.jsx re-render
  → Config effect fires: term.options.fontSize = 16
  → Terminal updates immediately (live preview)
```

### SSH terminal flow
```
User opens device terminal modal
  → TerminalDeviceModal mounts
  → Creates xterm.js Terminal with sshConfig from hook
  → WebSocket connects to /api/network/devices/{id}/terminal/ws
  → asyncssh connects to device via SSH
  → Bidirectional data relay via WebSocket
```

## Usage

### From the UI

**Console page:**
1. Click **Console** in the sidebar
2. A bash shell loads inside the `sentry-ansible` container with `/ansible` mounted
3. Run any Ansible command, e.g. `cd /ansible && ansible-playbook -i hosts.ini get_facts.yml`

**SSH terminal:**
1. Navigate to **Network Devices**
2. Click the terminal icon on any device
3. A modal opens with an interactive SSH session to that device

**Customize terminals:**
1. Navigate to **Settings**
2. Find the **Terminal Customization** card (third row, full width)
3. Switch between **SSH Terminal** and **Console** tabs
4. Adjust font size, font family, color scheme (with flavor picker), cursor style, or cursor blink
5. Changes apply instantly to any open terminal

### From the CLI

```bash
# Open an interactive shell (same as the Console page)
python watchman/scripts/container_manager.py shell

# Run a playbook directly (non-interactive)
python watchman/scripts/container_manager.py run get_facts.yml
```

### Via the API

```bash
# Console WebSocket (connect with any WebSocket client)
ws://localhost:8000/console/ws

# SSH terminal WebSocket for a specific device
ws://localhost:8000/api/network/devices/{device_id}/terminal/ws
```

### Building

```bash
# After pulling changes, install xterm.js dependencies
cd frontend && npm install
cd command-center && npm install

# Build the sentry-ansible image (required for Console)
python watchman/scripts/container_manager.py build ansible

# Restart watchman to pick up the new console route
podman-compose restart watchman
```

## Design Notes

- **Why PTY instead of `subprocess.PIPE`?** Without a PTY, `bash` inside the container detects `isatty(0) == false` and suppresses prompts, disables job control, and skips `.bashrc`. The PTY gives the container a real TTY, making the shell feel native.
- **Why `os.fork()` instead of `asyncio.create_subprocess_exec`?** The PTY slave fd must become the child's controlling terminal, which requires `os.setsid()` in the forked child before exec. `asyncio.create_subprocess_exec` doesn't give enough control over the session/controlling-terminal setup.
- **Two separate config tabs (SSH vs Console):** Network engineers often want different settings for short-lived device SSH sessions (smaller font, more compact) versus a long-running Console bash session where readability matters more.
- **localStorage over API persistence:** Terminal preferences are UI-only and don't need server-side storage. Keeping them in localStorage avoids adding database schema changes and API endpoints.
- **Flavor key format `"scheme-flavor"`:** Using a flat string with a hyphen separator rather than nested config fields (`{ scheme: "catppuccin", flavor: "mocha" }`) simplifies the config object, localStorage serialization, and the `resolveTheme()` signature. Backward compatible: single-variant themes like `"nord"` resolve correctly.
- **Intentional eslint `exhaustive-deps` suppression:** The terminal-creation effect reads config values but must not re-run when they change (that would destroy and recreate the terminal mid-session). A separate config-application effect handles live updates. The suppression is safe and documented inline.
