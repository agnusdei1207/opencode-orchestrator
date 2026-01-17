<div align="center">
  <img src="assets/logo.png" alt="Logo" width="200" />
</div>

# OpenCode Orchestrator

> Autonomous multi-agent plugin for [OpenCode](https://opencode.ai)

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/opencode-orchestrator.svg)](https://www.npmjs.com/package/opencode-orchestrator)
[![Tests](https://img.shields.io/badge/tests-216%20passed-brightgreen.svg)]()

---

## Overview

Multi-agent system that autonomously executes complex tasks. Commander delegates work to specialized agents, manages parallel execution, and maintains shared context.

| Capability | Detail |
|------------|--------|
| **Agents** | 4 consolidated (Commander, Planner, Worker, Reviewer) |
| **Parallel Sessions** | Up to 50 concurrent Worker Sessions |
| **Context Management** | `.opencode/` with adaptive summarization |
| **Memory Safety** | Auto GC, disk archiving |
| **Error Handling** | Pattern-based auto recovery + session recovery |
| **Todo Continuation** | Auto-continues when todos remain |
| **Smart Notifications** | TaskToastManager with consolidated views |

---

## 🏛️ Master Session Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           👤 USER REQUEST                                   │
│                        "/task Build a REST API"                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    🎯 MASTER SESSION (Commander Agent)                      │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ 1️⃣ THINK     → Analyze request, assess complexity (L1/L2/L3)         │  │
│  │ 2️⃣ PLAN      → Create .opencode/todo.md via Planner                  │  │
│  │ 3️⃣ DELEGATE  → Spawn Worker Sessions via delegate_task              │  │
│  │ 4️⃣ MONITOR   → Watch .opencode/ for progress, handle completions     │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────────────────────────────────────┐  │
│  │  Session State  │  │               4 CONSOLIDATED AGENTS             │  │
│  │  Map<id,state>  │  │  🎯 Commander  📋 Planner                       │  │
│  └─────────────────┘  │  🔨 Worker     ✅ Reviewer                       │  │
│                       └─────────────────────────────────────────────────┘  │
│  ┌─────────────────┐
│  │  Plugin Hooks   │                                                       │
│  │  event          │  ┌─────────────────────────────────────────────────┐  │
│  │  chat.message   │  │ 🔄 SessionRecovery (auto error handling)        │  │
│  │  tool.execute   │  │ 📋 TodoContinuation (auto-resume on idle)       │  │
│  └─────────────────┘  │ 📣 TaskToastManager (consolidated notifications)│  │
│                       └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                        delegate_task (async)
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           ▼                         ▼                         ▼
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│  ⚡ Worker Session 1 │  │  ⚡ Worker Session 2 │  │  ⚡ Worker Session N │
│  Agent: Planner     │  │  Agent: Worker      │  │  Agent: Reviewer    │
│                     │  │                     │  │                     │
│  • Independent exec │  │  • Independent exec │  │  • Independent exec │
│  • Read/Write       │  │  • Read/Write       │  │  • Read/Write       │
│    .opencode/       │  │    .opencode/       │  │    .opencode/       │
│  • Notify parent    │  │  • Notify parent    │  │  • Notify parent    │
│    on complete      │  │    on complete      │  │    on complete      │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
           │                         │                         │
           └─────────────────────────┼─────────────────────────┘
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    📁 SHARED CONTEXT (.opencode/)                           │
│                                                                             │
│  .opencode/todo.md     ← Master TODO (Planner creates, Reviewer updates)  │
│  .opencode/context.md  ← Adaptive context (shrinks as progress increases)  │
│  .opencode/docs/       ← Cached docs (Planner/Worker save, auto-expire)    │
│  .opencode/archive/    ← Old context for reference                         │
│                                                                             │
│  ⚡ All sessions read/write this shared workspace                           │
│  📊 Progress is tracked via todo.md checkboxes                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Installation

```bash
npm install -g opencode-orchestrator
```

Restart OpenCode after installation.

---

## Usage

### 🚀 Two Modes of Operation

| Mode | Trigger | Behavior |
|------|---------|----------|
| **Commander Mode** 🎯 | `/task "mission"` | Full autonomous execution until sealed |
| **Chat Mode** 💬 | Regular conversation | Simple Q&A, no autonomous behavior |

---

### 🎯 Commander Mode - `/task` (Recommended for Real Work)

Use `/task` when you need the AI to **complete a mission autonomously**:

```bash
/task "Fix the login bug in the docker-compose environment"
/task "Add dark mode support to the entire app"
/task "Refactor the API to use TypeScript"
```

**What Commander Mode Does:**
- ♾️ **Runs until sealed** — Loops until agent outputs `<mission_seal>SEALED</mission_seal>`
- 🧠 **Anti-Hallucination** — Researches docs before coding
- ⚡ **Parallel Execution** — Up to 50 concurrent agents
- 🔄 **Auto-Recovery** — Handles errors automatically
- 📊 **Triage System** — Adapts strategy to complexity (L1/L2/L3)

**🎖️ Mission Seal Loop:**
```
/task "mission" → Agent works → Idle? → Seal found? 
                       ↑              │
                       │      No      │ Yes
                       └──────────────┴──→ ✅ Complete
```

When the agent finishes ALL work, it outputs:
```xml
<mission_seal>SEALED</mission_seal>
```

**Control Commands:**
- `/stop` or `/cancel` — Stop the loop manually
- Max 20 iterations (configurable)

<div align="center">
  <img src="assets/tui_image.png" alt="Commander TUI" width="600" />
  <p><sub><b>/task "mission"</b> triggers full Commander mode with Mission Seal loop</sub></p>
</div>

---

### 💬 Chat Mode - Regular Conversation (Simple Q&A)

Just type normally without `/task` for simple questions:

```
How do I add a loading spinner?
What's the difference between useState and useReducer?
```

**Chat Mode is just regular conversation** — no autonomous execution, no parallel agents, no mission tracking.

---

> **💡 Pro Tip:** Use `/task` for anything that requires multiple steps, file changes, or verification. Use Chat Mode for quick questions.

---

## The 7 Agents

| Agent            | Role         | Responsibility                     |
| :--------------- | :----------- | :--------------------------------- |
| **Commander** 🎯 | Orchestrator | Autonomous mission control         |
| **Planner** 📋   | Planner + Research | Task decomposition, research, caching docs |
| **Worker** 🔨    | Developer + Docs | Full-stack implementation, documentation |
| **Reviewer** ✅  | Quality + Context | Verification, TODO updates, context management |

---

## 🛠️ Available Tools

| Tool | Description |
|------|-------------|
| `delegate_task` | Delegate work to subagent (async/sync) |
| `get_task_result` | Get result from delegated task |
| `list_tasks` | List all running/completed tasks |
| `cancel_task` | Cancel a running task |
| `webfetch` | Fetch URL content as Markdown |
| `websearch` | Search web (SearXNG → Brave → DuckDuckGo) |
| `codesearch` | Search open source code patterns |
| `cache_docs` | Manage cached documentation |
| `run_background` | Run command in background |
| `check_background` / `list_background` | Monitor background jobs |
| `grep_search` / `glob_search` / `mgrep` | Fast file search |

---

## 📊 Resource Guarantees

| Resource | Limit | Safety Mechanism |
|----------|-------|------------------|
| Parallel Sessions | 50 | Queue overflow protection |
| Tasks in Memory | 1,000 | Auto GC + disk archive |
| Notifications | 100/parent | FIFO eviction |
| Event History | 100 | Ring buffer |
| Session TTL | 60 min | Auto cleanup |
| Poll Interval | 1 second | Fast completion detection |
| Max Poll Count | 600 | Hard limit prevents infinite loops |
| Sync Timeout | 5 min | Safe delegate_task timeout |
| Recovery Attempts | 3 | Auto session error recovery |

---

## 🧪 Test Coverage

```
Test Files:  19 passed
Tests:       216 passed
Duration:    ~4.3s
```

---

## 🔄 Reliability Features

### Session Recovery
Automatic recovery from common errors:
- `tool_result_missing` - Tool crash recovery
- `thinking_block_order` - Thinking block issues
- `rate_limit` - API rate limiting with backoff
- Max 3 recovery attempts per session

### Todo Continuation
- Monitors `session.idle` events
- 2-second countdown before auto-continuation
- Cancels on user interaction
- Skips if background tasks running

### noReply Optimization
- Individual task completion: `noReply: true` (saves tokens)
- All tasks complete: `noReply: false` (AI processes results)

---

## Uninstall

```bash
npm uninstall -g opencode-orchestrator
```

---

## 🔧 Debugging

**Log file location:**
```bash
# Find log path (macOS uses /var/folders/...)
npm run log
# or:
tail -f "$(node -e 'console.log(require("os").tmpdir())')/opencode-orchestrator.log"

# Windows
# C:\Users\<username>\AppData\Local\Temp\opencode-orchestrator.log
```

---

## Documentation

- **[System Architecture](docs/SYSTEM_ARCHITECTURE.md)** — Detailed technical docs
- **[OpenCode SDK Reference](docs/OPENCODE_SDK_REFERENCE.md)** — API usage reference
- [Release Notes](docs/releases/) — Version history
- [Troubleshooting](docs/PLUGIN_TROUBLESHOOTING.md)

---

## License

MIT License. [LICENSE](LICENSE)

---

<div align="center">
  <b>Enterprise-scale. Memory-safe. Self-healing. Unlimited.</b>
</div>
