# Configuration Drift Reports - Clean Git-Diff Implementation

## Overview
Implemented a clean, production-grade configuration drift viewer that uses structured git-style diff parsing instead of flat lists of additions/removals.

## Architecture

### 1. **Diff Parser Utility** (`frontend/src/utils/diffParser.js`)
- **Purpose**: Parse unified diff format into structured hunks with context lines
- **Classes**:
  - `DiffLine`: Individual diff line with type (addition, removal, context) and content
  - `DiffHunk`: Collection of lines representing a single change chunk with header (@@ lines @@)
  - `ParsedDiff`: Complete diff with file headers and all hunks
- **Key Features**:
  - Parses standard unified diff format (--- before, +++ after, @@ hunks @@)
  - Preserves context lines (lines without + or -)
  - Extracts statistics (added/removed line counts per hunk and total)
  - Returns structured data suitable for rendering

### 2. **DiffViewer Component** (`frontend/src/components/DiffViewer.jsx`)
- **Purpose**: Reusable, production-ready diff display component
- **Features**:
  - **Summary Header**: Shows total additions/removals and hunk count
  - **File Headers**: Displays before/after file names with visual indicators
  - **Hunk Display**: 
    - Each hunk has sticky header with location and stats
    - Context lines shown with neutral styling
    - Additions highlighted in green
    - Removals highlighted in red
    - Line prefixes (+ − space) for quick scanning
  - **Compact Mode**: Supports `maxLines` prop to limit display (useful for dashboard previews)
  - **Line Wrapping**: Handles long config lines with proper text wrapping

### 3. **Backend Changes** (`watchman/app/services/playbook_service.py`)
- **Function**: `parse_config_drift_reports()`
- **Changes**:
  - Now includes full `diff_content` field in response
  - Maintains backward compatibility with existing `additions`/`removals` arrays
  - Sends raw diff to frontend for structured parsing
  - Benefits: Single source of truth, more flexible client-side rendering

### 4. **Frontend Pages**

#### **DriftReports.jsx** (List View)
- Grid of drift reports with compact diff previews
- Each card shows:
  - Device hostname
  - Last update timestamp
  - Preview of first 8 lines of diff using DiffViewer (compact mode)
  - Link to full report

#### **DriftReportDetail.jsx** (Full View)
- Full-page diff viewer with actions:
  - Back button to drift reports list
  - Copy diff button with feedback
  - Full DiffViewer showing all hunks
- Clean, professional layout

#### **Dashboard.jsx** (Preview Widget)
- Updated drift detection card to show:
  - Latest drift device name
  - Compact diff preview (max 12 lines)
  - Link to view all drift reports
  - "No drift detected" message when empty

## Data Flow

```
┌─────────────────────────────────────────────────────┐
│  Ansible Playbook (watchman)                        │
│  Generates: DRIFT_<hostname>.diff (unified format)  │
└────────────────┬────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────┐
│  Backend: parse_config_drift_reports()              │
│  Returns: {                                         │
│    hostname, path, mtime,                           │
│    diff_content (full),         ← NEW              │
│    additions, removals (legacy) ← backward compat   │
│  }                                                  │
└────────────────┬────────────────────────────────────┘
                 │
                 ↓ API Response
┌─────────────────────────────────────────────────────┐
│  Frontend: DiffViewer Component                     │
│  Input: diff_content (unified diff string)          │
│         ↓ (using diffParser.js)                    │
│  Output: Structured hunks with context             │
│         ↓ (React rendering)                        │
│  Display: Git-style diff with colors & context     │
└─────────────────────────────────────────────────────┘
```

## Usage Examples

### In Dashboard Widget
```jsx
{driftReports[0]?.diff_content && (
  <DiffViewer 
    diffContent={driftReports[0].diff_content} 
    compact={true} 
    maxLines={12} 
  />
)}
```

### In Full Report Page
```jsx
{content && <DiffViewer diffContent={content} />}
```

## Key Benefits

1. **Clean Separation of Concerns**
   - Parser: Pure utility function (testable)
   - Component: Pure React component (reusable)
   - Pages: Thin integration layers

2. **Context Preservation**
   - Shows surrounding lines for each change
   - Makes it clear what changed and why
   - Follows git diff conventions

3. **Backward Compatibility**
   - Legacy `additions`/`removals` arrays still present in API
   - Existing code can continue using them
   - New code uses cleaner diff format

4. **Performance**
   - Lazy parsing (only when rendered)
   - Memoized diff parsing to avoid recalculation
   - `maxLines` prop for efficient previews

5. **Extensibility**
   - DiffViewer can easily support:
     - Syntax highlighting by config type
     - Collapsible hunks
     - Side-by-side diff view
     - Unified/split view toggle
     - Search/filter functionality

## Visual Example

```
Summary: +45 −3 • 2 changes

− a/DRIFT_ESW10.diff
+ b/DRIFT_ESW10.diff

@@ -1,9 +1,8 @@  +1−1

 Building configuration...
 
-Current configuration : 3074 bytes        ← Removal (red)
+Current configuration : 5508 bytes        ← Addition (green)
 !
 ! No configuration change since last restart
-! NVRAM config last updated at 22:45:57   ← Removal
 !
 version 12.4
 service timestamps debug datetime msec
 
@@ -158,6 +157,69 @@  +1−0

 logging host 192.168.122.1 transport udp port 10514
+snmp-server community sentryPod RO         ← Addition
+snmp-server enable traps snmp              ← Addition
 [... more context lines ...]
```

## Testing Checklist

- ✅ Python syntax: No errors
- ✅ Frontend build: Successful (2496 modules)
- ✅ No TypeScript/JSX errors in components
- ✅ Diff parser handles standard unified format
- ✅ DiffViewer renders cleanly with proper colors
- ✅ Dashboard preview shows first N lines
- ✅ Full report page shows complete diff
- ✅ Backward compatibility maintained

## Files Modified/Created

### Created
- `frontend/src/utils/diffParser.js` - Diff parsing utility
- `frontend/src/components/DiffViewer.jsx` - Reusable diff viewer component

### Modified
- `watchman/app/services/playbook_service.py` - Added `diff_content` to API response
- `frontend/src/pages/DriftReports.jsx` - Updated to use DiffViewer
- `frontend/src/pages/DriftReportDetail.jsx` - Updated to use DiffViewer with icons
- `frontend/src/pages/Dashboard.jsx` - Updated drift card to show compact diff preview

## Next Steps (Optional Enhancements)

1. **Syntax Highlighting**: Color config commands by type (interface, vlan, routing, etc.)
2. **Diff Comparison**: Side-by-side baseline vs current view
3. **Advanced Filtering**: Hide certain change types or match patterns
4. **Export**: Download diff as text, JSON, or formatted document
5. **History**: Maintain diff history with timestamps
6. **Approval Workflow**: Integrate with staging gate for drift approval/rejection
