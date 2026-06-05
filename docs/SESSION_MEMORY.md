# AI Chat Session Memory — Context Window & Session Persistence

## Overview
The AI Chat Console previously operated as a **stateless** system — each message to the LLM was independent with no awareness of prior conversation. A **limited session memory** feature has been implemented that persists conversations to MongoDB, restores them on page reload, and sends the last 10 exchanges as context to the LLM so the assistant can reference earlier messages.

## What Changed

### Created
- `frontend/src/services/sessionService.js` — API client for session CRUD endpoints.
- `frontend/src/components/SessionSidebar.jsx` — collapsible left sidebar listing saved sessions with New Chat, switch, and delete (double-click confirmation) actions.

### Modified
- `watchman/app/database.py` — added `conversations_collection`.
- `watchman/app/routes/llm_routes.py` — rewrote `/llm/chat` to accept `session_id`, persist messages, trim history to `MAX_HISTORY_MESSAGES=10`; added 5 session management endpoints (`GET/POST/PUT/DELETE /llm/sessions`).
- `frontend/src/services/llmService.js` — `generateText()` now accepts an optional `sessionId` parameter; response includes `session_id`.
- `frontend/src/pages/AiChat.jsx` — integrated `SessionSidebar`, auto-save on each exchange, load/switch/delete sessions, loading spinner during session restore.

## Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Browser  (frontend/src/pages/AiChat.jsx)                                  │
│                                                                            │
│   ┌──────────────────────┐  ┌──────────────────────────────────────────┐   │
│   │  SessionSidebar      │  │  Chat Panel                              │   │
│   │  ┌──────────────────┐│  │  ┌────────────────────────────────────┐  │   │
│   │  │ Session list     ││  │  │ Messages (last N from DB)          │  │   │
│   │  │ [New Chat]       ││  │  │                                    │  │   │
│   │  │ Session 1   [x]  ││  │  │  ┌──────────────────────────────┐  │  │   │
│   │  │ Session 2   [x]  ├┼──┼──┼──┤ User: configure VLAN 10      │  │  │   │
│   │  │ Session 3   [x]  ││  │  │  │ AI: Here are the commands…   │  │  │   │
│   │  └──────────────────┘│  │  │  └──────────────────────────────┘  │  │   │
│   └──────────────────────┘  │  │  ┌──────────────────────────────┐  │  │   │
│                             │  │  │ Input box    [Send]          │  │  │   │
│                             │  │  └──────────────────────────────┘  │  │   │
│                             │  └────────────────────────────────────┘  │   │
│                             └──────────────────────────────────────────┘   │
│                                    │                                       │
│                                    ▼                                       │
│                              POST /llm/chat                                │
│                              { prompt, model, session_id }                 │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  FastAPI  (watchman/app/routes/llm_routes.py)                              │
│                                                                            │
│  /llm/chat:                                                                │
│    ├─ Load conversation from MongoDB (or create new)                       │
│    ├─ Trim history to last 10 messages                                     │
│    ├─ Build messages array: [system, ...last_10, new_prompt]               │
│    ├─ Call Hugging Face Router API                                         │
│    ├─ Save user message + assistant response to MongoDB                    │
│    └─ Return { text, reasoning, session_id, playbook_suggestions }         │
│                                                                            │
│  /llm/sessions:     (auth-protected, JWT required)                         │
│    ├─ GET    /sessions        → list all sessions (title, date, count)     │
│    ├─ GET    /sessions/{id}   → full conversation with all messages        │
│    ├─ POST   /sessions        → create new empty session                   │ 
│    ├─ PUT    /sessions/{id}   → rename session title                       │
│    └─ DELETE /sessions/{id}   → delete session                             │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  MongoDB  (sentry_pod_db.conversations)                                    │
│                                                                            │
│  {                                                                         │
│    _id: ObjectId,                                                          │
│    title: "Configure VLAN on core switch",    ← auto-generated from 1st    │
│    messages: [                                  user prompt                │
│      { role: "user",      content: "...", created_at: "..." },             │ 
│      { role: "assistant", content: "...",                                  │
│        reasoning: "...", model: "...",                                     │
│        playbook_suggestions: [...], created_at: "..." },                   │
│      ...                                                                   │
│    ],                                                                      │
│    created_at: ISODate,                                                    │
│    updated_at: ISODate                                                     │
│  }                                                                         │
└────────────────────────────────────────────────────────────────────────────┘
```

## File-by-File Detail

### 1. `watchman/app/database.py`
A single line added to register the new MongoDB collection:
```python
conversations_collection = db.get_collection("conversations")
```

### 2. `watchman/app/routes/llm_routes.py`

#### Model change — `ChatRequest`
```python
class ChatRequest(BaseModel):
    prompt: str
    model: str = "deepseek-ai/DeepSeek-R1:novita"
    session_id: str | None = None    # ← new
```
Accepts an optional `session_id`. If omitted, the backend auto-creates a new conversation.

#### Constants
```python
MAX_HISTORY_MESSAGES = 10   # ← new: context window limit
```

#### Chat endpoint — `/llm/chat` (POST)
The endpoint now follows this flow:
1. **API key** — same as before (MongoDB → env var fallback).
2. **Playbook suggestions** — same keyword-matching logic; injected into system prompt.
3. **Session resolution**:
   - If `session_id` is provided: load the conversation from MongoDB. Return 404 if not found.
   - If `session_id` is null: auto-create a new conversation. The first 60 characters of the user's prompt become the session title.
4. **Context window**:
   ```python
   history = conversation.get("messages", [])
   trimmed_history = history[-MAX_HISTORY_MESSAGES:]   # last 10 messages
   ```
   Builds the LLM payload as `[system_prompt, ...trimmed_history, new_user_message]`.
5. **HF API call** — unchanged retry logic (3 retries, 429/5xx handling).
6. **Persistence** — on success, both the user message and the assistant response (including `reasoning`, `model`, `playbook_suggestions`) are appended to the conversation's `messages` array and saved to MongoDB.

#### Session management endpoints (all auth-protected via `Depends(get_current_user)`)
| Method | Path                          | Purpose                                                |
|--------|-------------------------------|--------------------------------------------------------|
| GET    | `/llm/sessions`               | List all conversations, sorted by `updated_at` desc. Returns id, title, created_at, updated_at, message_count. |
| GET    | `/llm/sessions/{session_id}`  | Full conversation document including the entire `messages` array. |
| POST   | `/llm/sessions`               | Create a new empty conversation with title `"New Chat"`. Returns `session_id`. |
| PUT    | `/llm/sessions/{session_id}`  | Update the session title. Requires `{ title: "..." }` in the request body. |
| DELETE | `/llm/sessions/{session_id}`  | Delete the conversation document entirely.             |

The `list_sessions` endpoint uses an aggregation pipeline to compute `message_count` via `$size` without loading the full messages array:
```python
cursor = conversations_collection.aggregate([
    {"$sort": {"updated_at": -1}},
    {"$project": {
        "title": 1,
        "created_at": 1,
        "updated_at": 1,
        "message_count": {"$size": {"$ifNull": ["$messages", []]}}
    }}
])
```

### 3. `frontend/src/services/sessionService.js`
Wraps the 5 session endpoints via the existing `api` axios instance (which automatically attaches the JWT Bearer token):
```javascript
export async function listSessions()        // GET   /llm/sessions
export async function getSession(sessionId) // GET   /llm/sessions/{id}
export async function createSession()        // POST  /llm/sessions
export async function updateSessionTitle()  // PUT   /llm/sessions/{id}
export async function deleteSession()        // DELETE /llm/sessions/{id}
```

### 4. `frontend/src/services/llmService.js`
`generateText()` now accepts a third parameter `sessionId` (default `null`):
```javascript
export async function generateText(prompt, model, sessionId = null) {
  const body = { prompt, model };
  if (sessionId) body.session_id = sessionId;
  // ... fetch POST /llm/chat ...
  // Response now includes: { text, reasoning, model, session_id, playbook_suggestions }
}
```
The response `session_id` is returned so the frontend can persist it for subsequent messages.

### 5. `frontend/src/components/SessionSidebar.jsx`
A fixed left sidebar (288px / `w-72`) with the following elements:

| Element  | Behaviour |
|----------|-----------|
| **Header**  | "Sessions" title + close button (`ChevronLeft`). |
| **New Chat**  | Dashed-border button at the top that calls `createSession()` and resets the message state. |
| **Session list**  | Scrollable list, each item shows title (truncated), relative timestamp (via `formatRelativeTime`), and exchange count. Active session highlighted with `bg-blue-600/15`. |
| **Delete**  | Hover-revealed trash icon per row. First click arms (red highlight), second click within 3s confirms deletion. |
| **Mobile overlay**  | Semi-transparent backdrop (`bg-black/30`) on screens < `lg:` when sidebar is open; tapping it closes the sidebar. |

The sidebar is toggled from a **Sessions** button in the chat page header (styled consistently with the adjacent API Key button).

### 6. `frontend/src/pages/AiChat.jsx`

#### New state
```javascript
const [sessions, setSessions] = useState([]);          // list from backend
const [activeSessionId, setActiveSessionId] =           // current session
  useState(() => localStorage.getItem("active_session_id") || null);
const [sidebarOpen, setSidebarOpen] = useState(false);
const [loadingSession, setLoadingSession] = useState(false);
```

#### On mount — `useEffect`
1. Fetches all sessions via `listSessions()`.
2. Determines target session:
   - If `activeSessionId` (from localStorage) still exists in the list, load it.
   - Otherwise, fall back to the most recently updated session.
   - If no sessions exist, set `activeSessionId` to `null` (first message will auto-create one).
3. Calls `loadSessionMessages(targetId)` to populate the `messages` state from the backend.

#### `loadSessionMessages(sessionId)`
Fetches the full conversation via `getSession(sessionId)`, maps the persisted `messages` array to the frontend's message format (`role: "user"/"ai"`, `text`, `reasoning`, `model`, `playbook_suggestions`, `time`), and sets `messages`. Shows a loading spinner while the request is in flight.

#### `sendMessage()`
1. Adds the user message and a "Thinking..." placeholder to local state (optimistic).
2. Calls `generateText(userText, selectedModel, activeSessionId)`.
3. On success:
   - If the response includes a new `session_id` (first message in a new session), saves it to state and localStorage, refreshes the session list.
   - Replaces the "Thinking..." placeholder with the AI response.
4. On error: replaces "Thinking..." with an error message.

#### Session handlers
| Handler | Behaviour |
|---------|-----------|
| `handleSelectSession(id)` | Closes sidebar, loads session messages. |
| `handleNewSession()` | Creates session via API, resets messages to welcome text, refreshes session list. |
| `handleDeleteSession(id)` | Deletes via API, removes from local list. If it was the active session, loads the next available session or auto-creates a new one. |

## Data Flow (Frontend ↔ Backend ↔ MongoDB)

```
User types message
  └─→ sendMessage()
       └─→ generateText(prompt, model, activeSessionId)
            └─→ fetch POST /llm/chat { prompt, model, session_id }
                 └─→ FastAPI /llm/chat
                      ├─→ load_conversation(session_id)        ← MongoDB
                      ├─→ trim to last 10 messages
                      ├─→ POST https://router.huggingface.co/v1/chat/completions
                      │    messages: [system, ...trimmed_history, user_prompt]
                      ├─→ save_conversation(session_id, messages + [user, assistant])  → MongoDB
                      └─→ return { text, reasoning, session_id, playbook_suggestions }
            └─→ update messages state
            └─→ if new session_id: save to localStorage, refresh sidebar list
```

```
User switches session via sidebar
  └─→ handleSelectSession(id)
       └─→ loadSessionMessages(id)
            └─→ getSession(id)  → GET /llm/sessions/{id}
                 └─→ FastAPI
                      └─→ load_conversation(id)  ← MongoDB
                      └─→ return { session_id, title, messages: [...] }
            └─→ map messages to frontend format
            └─→ setMessages(loaded)
            └─→ setActiveSessionId(id)
```

## Usage

### From the UI
1. Navigate to **AI Chat Console** (`/ai-chat`).
2. **Start a conversation** — type a message and press Enter. A session is auto-created.
3. **View sessions** — click the **Sessions** button in the header (left of the API Key button) to open the sidebar.
4. **Switch sessions** — click any session in the sidebar to load its full history.
5. **New session** — click **New Chat** at the top of the sidebar.
6. **Delete a session** — hover over a session row, click the trash icon once to arm (turns red), click again within 3 seconds to confirm deletion.
7. **Page refresh** — the last active session is restored automatically from localStorage.

### Via the API
```bash
# List all sessions
curl http://127.0.0.1:8000/llm/sessions \
  -H "Authorization: Bearer <jwt_token>"
# → { "sessions": [{ "session_id": "...", "title": "...", "message_count": 4, ... }] }

# Get full conversation
curl http://127.0.0.1:8000/llm/sessions/<session_id> \
  -H "Authorization: Bearer <jwt_token>"
# → { "session_id": "...", "title": "...", "messages": [{ "role": "user", ... }, ...] }

# Create new empty session
curl -X POST http://127.0.0.1:8000/llm/sessions \
  -H "Authorization: Bearer <jwt_token>"
# → { "session_id": "...", "title": "New Chat", "messages": [] }

# Rename a session
curl -X PUT http://127.0.0.1:8000/llm/sessions/<session_id> \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{"title": "VLAN troubleshooting"}'
# → { "status": "success", "title": "VLAN troubleshooting" }

# Delete a session
curl -X DELETE http://127.0.0.1:8000/llm/sessions/<session_id> \
  -H "Authorization: Bearer <jwt_token>"
# → { "status": "success", "message": "Session deleted" }

# Chat with session context
curl -X POST http://127.0.0.1:8000/llm/chat \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "configure VLAN 10 on interface GigabitEthernet0/1",
    "model": "deepseek-ai/DeepSeek-R1:novita",
    "session_id": "<session_id>"
  }'
# → { "text": "...", "reasoning": "...", "session_id": "...", "playbook_suggestions": [...] }
```

## Design Notes

- **Why embed messages in the conversation document instead of a separate `messages` collection?** Conversations in this application are expected to be small (tens of messages, not thousands). Embedding keeps reads simple (one query to load everything) and avoids joins or multiple round-trips. The 16MB MongoDB document size limit is not a concern at this scale.
- **Why the 10-message context window?** 10 user+assistant exchanges provide enough context for a coherent conversation while keeping token usage predictable and latency low. The limit can be tuned by changing `MAX_HISTORY_MESSAGES` in `llm_routes.py`.
- **Why auto-create sessions on the first message rather than upfront?** Users often open the AI Chat page without intending to immediately send a message. Deferring session creation to the first exchange avoids cluttering the database with empty conversations.
- **Why double-click delete?** Prevents accidental deletion during rapid session switching. The 3-second auto-reset means the confirmation state is self-cleaning.
- **Why `fetch` (not `axios`) for the chat endpoint?** The chat endpoint is unauthenticated (no JWT required), while the session CRUD endpoints use the existing `api` axios instance which attaches JWT tokens automatically. This matches the pre-existing pattern where `llmService.js` uses raw `fetch` and other services use `axios`.
- **Why no user-scoped sessions?** The chat endpoint is unauthenticated. Session CRUD endpoints require a valid JWT (any authenticated user). All authenticated users share the same session pool, which is appropriate for an internal team tool. User-scoped isolation would require authenticating the chat endpoint and filtering by `user_id`.
