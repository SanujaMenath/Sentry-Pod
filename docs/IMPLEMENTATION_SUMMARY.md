# Configuration Drift Reports — Git-Style Diff Viewer

## Overview

A clean, production-grade configuration drift viewer that parses unified diff output from Ansible playbooks into structured hunks with context lines, rendered as a git-style diff in the React frontend. This replaced a flat list of additions/removals with a display that preserves surrounding context for each change.

## What Changed

### Created
- `frontend/src/utils/diffParser.js` — Unified diff parser that produces structured `DiffLine`, `DiffHunk`, and `ParsedDiff` objects
- `frontend/src/components/DiffViewer.jsx` — Reusable React component for rendering git-style diffs with color-coded additions/removals/context

### Modified
- `watchman/app/services/playbook_service.py` — `parse_config_drift_reports()` now includes the full `diff_content` field in API responses (backward compatible, legacy `additions`/`removals` arrays preserved)
- `frontend/src/pages/DriftReports.jsx` — Uses DiffViewer in compact mode for report previews
- `frontend/src/pages/DriftReportDetail.jsx` — Uses DiffViewer with copy-diff action
- `frontend/src/pages/Dashboard.jsx` — Drift card shows compact DiffViewer preview (max 12 lines)

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Ansible Playbook (sentry-ansible container)         │
│  Outputs: DRIFT_<hostname>.diff (unified format)     │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  Backend: parse_config_drift_reports()              │
│  Returns: { hostname, path, mtime,                  │
│             diff_content (full unified diff),       │
│             additions, removals (legacy compat) }   │
└────────────────┬────────────────────────────────────┘
                 │  /api/network/drift/reports
                 ▼
┌─────────────────────────────────────────────────────┐
│  Frontend: diffParser.js                            │
│  Parses unified diff → DiffHunk[] (lazy, memoized)  │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  Frontend: DiffViewer.jsx                           │
│  Renders color-coded git-style diff with context    │
│  ├── DriftReports.jsx (compact card preview)        │
│  ├── DriftReportDetail.jsx (full report page)       │
│  └── Dashboard.jsx (compact widget, 12 lines max)   │
└─────────────────────────────────────────────────────┘
```

## File-by-File Detail

### 1. `frontend/src/utils/diffParser.js`

Three classes in a pure utility:

- **`DiffLine`** — single diff line with `type` (`addition`, `removal`, `context`) and `content`
- **`DiffHunk`** — a change chunk with `header` (`@@ -n,m +n,m @@`), stats, and `DiffLine[]`
- **`ParsedDiff`** — file-level headers (`---`/`+++`) and `DiffHunk[]`

Parses standard unified diff format. No external dependencies.

### 2. `frontend/src/components/DiffViewer.jsx`

Props: `diffContent` (string), `compact` (boolean), `maxLines` (number).

Renders:
- Summary header — total additions/removals and hunk count
- File headers — before/after filenames with visual indicators
- Hunks — sticky header with location and stats, green additions, red removals, neutral context
- Supports `maxLines` truncation for dashboard previews
- Handles long config lines with text wrapping

### 3. `watchman/app/services/playbook_service.py`

`parse_config_drift_reports()` reads `.diff` files from the filesystem. Previously returned only aggregated `additions`/`removals` counts. Now also returns the raw `diff_content` string so the frontend has a single source of truth for rendering.

## Data Flow

```
Ansible playbook executes in sentry-ansible container
        │
        ▼
Writes DRIFT_<hostname>.diff to watchman/playbooks/drift_reports/
        │
        ▼
Backend reads .diff files → parse_config_drift_reports()
        │  JSON response: { diff_content, additions, removals }
        ▼
Frontend API call → diffParser.js parses unified diff
        │  → DiffHunk[] with context lines
        ▼
DiffViewer component renders color-coded git-style view
```

## Usage

### From the UI

1. Navigate to **Drift Reports** page from the sidebar
2. Each card shows the device hostname, timestamp, and a compact diff preview
3. Click a card to see the full diff report
4. Use the **Copy** button on the detail page to copy the diff

### From the CLI

```bash
# Trigger drift analysis
python watchman/scripts/container_manager.py run configDrift.yml

# View raw diff files
ls watchman/playbooks/drift_reports/
cat watchman/playbooks/drift_reports/DRIFT_ESW10.diff
```

### Via the API

```bash
# List drift reports
curl http://localhost:8000/playbooks/drift/refresh

# Get full report details
curl http://localhost:8000/api/network/drift/reports
```

## Design Notes

- **Backward compatibility retained:** The legacy `additions`/`removals` arrays still exist in the API response. Existing code that reads them continues to work. New code should use `diff_content`.
- **Lazy parsing:** The diff parser runs only when the DiffViewer component renders. Parsed output is memoized to avoid recalculation on re-renders.
- **Compact mode:** `maxLines` prop enables efficient preview rendering (used in DriftReports cards and Dashboard widget) without parsing the entire diff.
- **Extensibility:** The DiffViewer component can be extended for syntax highlighting, collapsible hunks, side-by-side view, or search/filter without changes to the parser.
