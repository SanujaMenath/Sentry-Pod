# AI-Driven Playbook Modification

## Overview

Lets non-technical users modify and execute Ansible playbooks through the AI Chat UI without touching the CLI. The AI proposes YAML changes (scope, variables), the user approves via a diff viewer, and the modified playbook is saved as a new file, registered in the catalog, and optionally executed — all in a few clicks.

## What Changed

### Created
- `frontend/src/components/PlaybookModificationCard.jsx` — chat UI component showing diff, metadata, approve/reject/execute buttons

### Modified
- `watchman/app/models/playbook.py` — added `ModifyProposeRequest`, `ModifyApproveRequest`, `ModifyProposeResponse` models; added `modification_potential` field to `PlaybookSuggestion`
- `watchman/app/services/playbook_service.py` — added `generate_playbook_modification()` (LLM call), `get_inventory_groups()`, `compute_yaml_diff()`, `derive_modified_filename()`, `save_modified_playbook()`, `check_modification_potential()`
- `watchman/app/routes/playbook_routes.py` — added `POST /playbooks/modify/propose` and `POST /playbooks/modify/approve`
- `watchman/app/routes/llm_routes.py` — updated system prompt with strict response priority chain (perfect match → scope mismatch → fallback commands), target_devices info in suggestion listing
- `frontend/src/pages/AiChat.jsx` — added Modify button handler, `PlaybookModificationCard` rendering, post-save execute prompt, staging gate for destructive modified playbooks
- `frontend/src/services/llmService.js` — added `proposeModification()` and `approveModification()` functions
- `frontend/src/components/PlaybookSuggestions.jsx` — added Modify button (visible only when `modification_potential: true`)
- `command-center/` — all frontend changes synced

## Architecture

```
User: "Modify get_facts.yml to edge devices"
       │
       ▼
POST /llm/chat → playbook_service.find_playbook_suggestions()
       │         returns get_facts.yml (score >= 2, modification_potential=true)
       │
       ▼
AI responds: "I found get_facts.yml targeting all hosts. Click Modify..."
       │
  User clicks [Modify] button
       │
       ▼
POST /playbooks/modify/propose {playbook_name, modification, model}
       │
       ├─ read_playbook_content() → original YAML
       ├─ get_inventory_groups() → ["allHosts", "Edge_routers", ...]
       ├─ Call HF API with MODIFY_SYSTEM_PROMPT + groups list
       │  → returns modified YAML in ```yaml block, metadata in ```json block
       ├─ compute_yaml_diff() → unified diff
       └─ return proposal (diff, metadata, plain_explanation)
       │
       ▼
Chat shows PlaybookModificationCard with collapsible diff
  [Approve & Save] [Reject]
       │
       ▼
POST /playbooks/modify/approve {original_name, proposed_name, modified_content, metadata}
       │
       ├─ save_playbook_file() → NTP_edge_modified.yml
       ├─ save_catalog() → +entry in catalog.json
       ├─ MongoDB playbooks collection → +blueprint document
       └─ return {status, filename}
       │
       ▼
"✅ Saved! Execute now?" [▶ Execute Now] [Not Now]
       │
  [Execute Now] → PlaybookStagingGate (if destructive) → SSE stream
```

## File-by-File Detail

### 1. `watchman/app/services/playbook_service.py`

**`get_inventory_groups()`** — parses `hosts.ini` for all `[group_name]` entries. Returns exact capitalization (e.g. `Edge_routers`, not `edge_routers`). Used to inject valid group names into the LLM prompt so the modified YAML uses case-correct host targets.

**`generate_playbook_modification()`** — calls the HuggingFace API with a two-part prompt:
- System: `MODIFY_SYSTEM_PROMPT` — strict instructions to only change what's asked, use exact group names, output YAML in ` ```yaml ` block and metadata in ` ```json ` block
- User: original YAML + modification request + valid inventory groups list
- Parsing extracts YAML via regex `r'```yaml\n([\s\S]*?)```'` and metadata via `r'```json\n([\s\S]*?)```'`

**`check_modification_potential()`** — returns `True` when scope mismatches in either direction:
- User wants "all/every" but playbook targets a specific group
- User mentions "edge/core/access" but playbook targets allHosts

**`save_modified_playbook()`** — saves YAML file, appends to `catalog.json`, returns `(filename, catalog_entry_dict)` for the route handler to persist to MongoDB.

### 2. `watchman/app/routes/llm_routes.py`

System prompt updated with `RESPONSE PRIORITY` chain:

```
Step 1 — Perfect match: recommend directly, stop
Step 2 — Scope mismatch (purpose matches, scope off): suggest Modify, stop
Step 3 — No match: generate commands
```

Each playbook in the suggestion listing now includes `Targets: Edge_routers` so the LLM knows the scope.

### 3. `frontend/src/components/PlaybookModificationCard.jsx`

Reuses existing `DiffViewer` (from Drift Reports) inside a collapsible `<details>` element. States:
- **Proposal state**: plain explanation + metadata badges + diff preview + [Approve & Save] / [Reject] / [Copy Diff]
- **Post-save state**: [Execute Now] / [Not Now] buttons

### 4. `frontend/src/pages/AiChat.jsx`

Key hooks in the modification flow:
- **Modify button** (`onModify`) — finds the last user message, calls `handleProposeModification(suggestion, lastUserText)` directly (no input trick)
- **handleApproveModification** — calls `/playbooks/modify/approve`, if destructive sets `pendingPlaybook` with `_isModified: true` so `PlaybookStagingGate` opens before execute
- **Model selection** — passes `selectedModel` to the propose endpoint; defaults to `Qwen/Qwen3.5-4B:featherless-ai` for fast (~5-10s) modification generation; shows estimated time in the progress message

## Data Flow

```
User message ──→ /llm/chat ──→ find_playbook_suggestions() ──→ AI response + suggestions
                    │                                              with modification_potential flags
                    ▼
User clicks [Modify] ──→ proposeModification() ──→ /playbooks/modify/propose
                    │                                   │
                    │                                   ├─ read YAML + inventory groups
                    │                                   ├─ HF API call (fast model)
                    │                                   └─ return diff + metadata
                    ▼
PlaybookModificationCard ──→ Approve → approveModification() → /playbooks/modify/approve
                    │                                              │
                    │                                              ├─ save_playbook_file()
                    │                                              ├─ save_catalog()
                    │                                              └─ MongoDB insert
                    ▼
[Execute Now] ──→ PlaybookStagingGate (if destructive) ──→ /playbooks/execute-stream/<filename>
```

## Usage

### From the UI
1. Type a request with scope mismatch: "Gather facts on edge devices"
2. AI responds: "I found get_facts.yml which targets all hosts. I can modify it for you."
3. Click the **Modify** button on the get_facts.yml card
4. Wait for the proposal (model-specific estimated time shown)
5. Review the diff in the collapsible "View YAML diff" section
6. Click **[Approve & Save]** (or **[Reject]**)
7. If destructive: confirm in the PlaybookStagingGate modal
8. Click **[Execute Now]** to run the modified playbook via SSE stream

### Via the API
```bash
# Propose a modification
curl -X POST http://localhost:8000/playbooks/modify/propose \
  -H "Content-Type: application/json" \
  -d '{
    "playbook_name": "get_facts.yml",
    "modification": "change target to edge devices",
    "model": "Qwen/Qwen3.5-4B:featherless-ai"
  }'

# Approve and save
curl -X POST http://localhost:8000/playbooks/modify/approve \
  -H "Content-Type: application/json" \
  -d '{
    "original_name": "get_facts.yml",
    "proposed_name": "get_facts_modified.yml",
    "modified_content": "---\n- name: ...\n  hosts: Edge_routers\n  ...",
    "metadata": {
      "name": "Gather Info from Edge Devices",
      "tags": ["facts", "gather", "edge"],
      "severity": "low",
      "destructive": false,
      "target_devices": ["Edge_routers"]
    }
  }'
```

## Design Notes

- **YAML via code blocks** — the initial approach asked the LLM to return YAML embedded in JSON (`"modified_yaml": "..."`), but escaping YAML inside JSON strings is fragile. Switched to extracting from ` ```yaml ` and ` ```json ` code blocks via regex, which is more reliable.
- **Fast model default** — the propose endpoint defaults to `Qwen/Qwen3.5-4B` instead of `DeepSeek-R1` because YAML modification doesn't benefit from chain-of-thought reasoning. This cuts generation time from ~45s to ~5-10s. The user's chat model selection is forwarded, so the conversation still uses their preferred model.
- **Exact group names** — Ansible's `hosts:` is case-sensitive. The LLM prompt includes the exact `hosts.ini` group names so modifications use `Edge_routers` instead of `edge_routers` (which would match 0 devices).
- **Modify button visibility** — only shown when `modification_potential: true`, which fires on scope mismatch in either direction (user wants broad, playbook targets specific — or user mentions specific, playbook targets allHosts).
- **No auto-propose** — the AI tells users to click the Modify button rather than auto-generating the proposal, giving users control and avoiding an unexpected slow LLM call after every message.
- **Inventory group list** — `get_inventory_groups()` reads all `[section]` headers from `hosts.ini` each time rather than caching, since the file can change during development. Cache if it becomes a performance concern.
