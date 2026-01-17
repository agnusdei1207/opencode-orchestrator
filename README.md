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

## 🏛️ Architecture Overview

### 🚀 User Flow: Real Scenario

> **Example:** `/task "Build a REST API with user authentication"`

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  👤 USER: /task "Build a REST API with user authentication"                     │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          🎯 COMMANDER (Master Session)                          │
│                                                                                 │
│  "I'll break this into parallel tasks and delegate to specialized agents"      │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │  📋 Creates TODO.md:                                                    │    │
│  │  - [ ] Research: Express.js + JWT best practices                        │    │
│  │  - [ ] Setup: Project structure + dependencies                          │    │
│  │  - [ ] Implement: User model + auth routes                              │    │
│  │  - [ ] Test: API endpoints verification                                 │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
              ▼                        ▼                        ▼

    ╔═══════════════════╗   ╔═══════════════════╗   ╔═══════════════════╗
    ║ 🔍 PLANNER        ║   ║ 🔨 WORKER #1      ║   ║ 🔨 WORKER #2      ║
    ║ Session: ses_001  ║   ║ Session: ses_002  ║   ║ Session: ses_003  ║
    ╠═══════════════════╣   ╠═══════════════════╣   ╠═══════════════════╣
    ║ Research Express  ║   ║ Create src/       ║   ║ Write auth.ts     ║
    ║ + JWT docs        ║   ║ Setup package.json║   ║ + user.model.ts   ║
    ║                   ║   ║                   ║   ║                   ║
    ║ 📥 websearch()    ║   ║ 📥 write files    ║   ║ 📥 write files    ║
    ║ ⏳ cache_docs()   ║   ║ ⏳ run_background ║   ║                   ║
    ╚═══════════════════╝   ║    → npm install  ║   ╚═══════════════════╝
              │             ╚═══════════════════╝             │
              │                        │                      │
              │    ⚡ ALL RUN IN PARALLEL (async: true)       │
              │    ⏱️ Commander monitors, doesn't wait        │
              └────────────────────────┼──────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         🔄 BACKGROUND PROCESSES                                 │
│                                                                                 │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │
│   │ npm install     │  │ npm run build   │  │ npm test        │                │
│   │ (bg_cmd_001)    │  │ (bg_cmd_002)    │  │ (bg_cmd_003)    │                │
│   │ ⏳ running...   │  │ ⏳ running...   │  │ ⏳ pending...   │                │
│   └─────────────────┘  └─────────────────┘  └─────────────────┘                │
│                                                                                 │
│   • Check with: check_background / list_background                              │
│   • Non-blocking: Commander continues other work                                │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         📊 ASYNC RESULT COLLECTION                              │
│                                                                                 │
│   get_task_result("ses_001") ──▶ ✅ Planner done: "Found JWT patterns..."      │
│   get_task_result("ses_002") ──▶ ✅ Worker #1 done: "Project setup complete"   │
│   get_task_result("ses_003") ──▶ ⏳ Still running...                            │
│                                                                                 │
│   Commander: "Worker #2 still working, I'll delegate review task meanwhile"    │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
    ╔═══════════════════╗
    ║ ✅ REVIEWER       ║
    ║ Session: ses_004  ║
    ╠═══════════════════╣
    ║ Verify endpoints  ║
    ║ Update TODO.md:   ║
    ║  - [x] Research ✓ ║
    ║  - [x] Setup ✓    ║
    ║  - [x] Implement ✓║
    ║  - [x] Test ✓     ║
    ╚═══════════════════╝
              │
              ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          🎖️ MISSION COMPLETE                                    │
│                                                                                 │
│   Commander: "All TODOs checked. Mission complete."                             │
│                                                                                 │
│   Output: <mission_seal>SEALED</mission_seal>                                   │
│                                                                                 │
│   ✅ Session cleanup → Resources freed → Ready for next mission                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Key Concepts Visualized:**

| Concept | How It Works |
|---------|--------------|
| **Session** | Each agent runs in isolated session (ses_001, ses_002...) |
| **Parallel Agents** | Multiple Workers execute simultaneously, not sequentially |
| **Background Commands** | Long-running commands (npm install) don't block agents |
| **Async Collection** | Commander polls results, continues work while waiting |
| **Auto-Continue** | If TODOs remain, loop continues until all `[x]` checked |

### 📊 Project Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         OpenCode Orchestrator Plugin                            │
│                              src/index.ts                                       │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          ▼                           ▼                           ▼
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────────────┐
│   Plugin Hooks      │  │   Core Systems      │  │         Tools               │
│   plugin-handlers/  │  │   src/core/         │  │       src/tools/            │
├─────────────────────┤  ├─────────────────────┤  ├─────────────────────────────┤
│ • chat.message      │  │ • agents/           │  │ • parallel/                 │
│ • event             │  │   ParallelManager   │  │   delegate_task             │
│ • tool.execute      │  │   TaskStore         │  │   get_task_result           │
│ • assistant.done    │  │   Concurrency       │  │ • web/                      │
└─────────────────────┘  │ • loop/             │  │   webfetch, websearch       │
                         │   MissionSeal       │  │ • background-cmd/           │
                         │   TodoContinuation  │  │   run_background            │
                         │ • recovery/         │  │ • search                    │
                         │   SessionRecovery   │  │   grep, glob, mgrep         │
                         │ • notification/     │  └─────────────────────────────┘
                         │   Toast, Manager    │
                         │ • session/          │
                         │   SharedContext     │
                         │ • cache/            │
                         │   DocumentCache     │
                         └─────────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          ▼                           ▼                           ▼
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│   🎯 Commander       │  │   📋 Planner        │  │   🔨 Worker          │
│   Orchestrator      │  │   Research+Plan     │  │   Implementation    │
├─────────────────────┤  ├─────────────────────┤  ├─────────────────────┤
│ • Mission control   │  │ • Task decompose    │  │ • Code writing      │
│ • Parallel delegate │  │ • Doc research      │  │ • File operations   │
│ • TODO monitoring   │  │ • TODO creation     │  │ • Command execution │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
          │                           │                           │
          │                           │                           │
          │                  ┌────────┴────────┐                  │
          │                  ▼                 │                  │
          │       ┌─────────────────────┐      │                  │
          │       │   ✅ Reviewer        │      │                  │
          │       │   Quality+Context   │      │                  │
          │       ├─────────────────────┤      │                  │
          │       │ • Verification      │      │                  │
          │       │ • TODO updates      │      │                  │
          │       │ • Context manage    │      │                  │
          │       └─────────────────────┘      │                  │
          │                  │                 │                  │
          └──────────────────┼─────────────────┴──────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        📁 Shared Workspace (.opencode/)                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│  todo.md          │ Hierarchical task list (Epic → Task → Subtask)             │
│  context.md       │ Adaptive context (shrinks with progress)                   │
│  loop-state.json  │ Mission loop iteration state                               │
│  docs/            │ Cached documentation (auto-expire)                         │
│  archive/         │ Old context snapshots                                      │
└─────────────────────────────────────────────────────────────────────────────────┘
```


### 📂 Directory Structure

```
src/
├── index.ts                      # Plugin main entry point
├── agents/
│   ├── commander.ts              # Commander agent definition
│   ├── definitions.ts            # Agent exports
│   ├── prompts/                  # Prompt fragments (commander/, planner/, worker/, reviewer/)
│   └── subagents/                # Subagent definitions (planner.ts, worker.ts, reviewer.ts)
├── core/
│   ├── agents/                   # ParallelAgentManager, TaskStore, ConcurrencyController
│   ├── cache/                    # DocumentCache
│   ├── loop/                     # MissionSeal, TodoContinuation, TodoEnforcer
│   ├── notification/             # Toast, TaskToastManager
│   ├── recovery/                 # SessionRecovery, ErrorPatterns
│   ├── session/                  # SharedContext
│   └── task/                     # TaskScheduler, TaskParser
├── plugin-handlers/
│   ├── chat-message-handler.ts   # /task detection, mission start
│   ├── event-handler.ts          # session.idle, session.error handling
│   ├── tool-execute-handler.ts   # Tool completion tracking
│   └── assistant-done-handler.ts # Response completion
├── shared/
│   ├── constants/                # PATHS, TOOL_NAMES, MISSION_SEAL, etc.
│   ├── agent/                    # Agent definitions, names
│   └── errors/                   # Error types
├── tools/
│   ├── parallel/                 # delegate_task, get_task_result, list_tasks, cancel_task
│   ├── web/                      # webfetch, websearch, codesearch, cache_docs
│   ├── background-cmd/           # run_background, check_background, list_background
│   └── search.ts                 # grep_search, glob_search, mgrep
└── utils/                        # Utility functions
```


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
- ⚡ **Parallel Execution** — Up to 50 concurrent Worker Sessions
- 🔄 **Auto-Recovery** — Handles errors automatically with pattern matching
- 📊 **Progress Tracking** — Monitors TODO completion and shows progress

**Concurrency Limits (per agent type):**
| Agent | Max Concurrent | Purpose |
|--------|---------------|-----------|
| Commander | 1 | Single orchestrator per mission |
| Planner | 3 | Research and TODO planning |
| Worker | 10 | Implementation tasks |
| Reviewer | 5 | Verification and testing |

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

## 🔄 Mission Loop Mechanism

The Commander uses an event-driven mission loop to autonomously complete missions:

```
┌─────────────────────────────────────────────────────────────────┐
│                  MISSION LOOP LIFECYCLE                       │
└─────────────────────────────────────────────────────────────────┘

1️⃣ User sends "/task 'mission'"
    ↓
2️⃣ chat.message handler detects /task
    ↓
3️⃣ Create session + startMissionLoop()
    ↓
    Write .opencode/loop-state.json:
    {
      "active": true,
      "sessionID": "ses_abc",
      "iteration": 1,
      "maxIterations": 20
    }
    ↓
4️⃣ Commander receives prompt → delegates work
    ↓
5️⃣ Worker sessions execute → results collected
    ↓
6️⃣ session.idle event triggers
    ↓
    Check for <mission_seal>SEALED</mission_seal>
    ├─ Seal found? → Clear loop state → Complete ✅
    └─ Not found? → Increment iteration → Continue loop
         ↓
         Show countdown toast (3 seconds)
         ↓
         Inject continuation prompt
         ↓
         [Loop back to step 4]
```

**Key Loop Components:**

| Component | File | Purpose |
|-----------|-------|---------|
| Loop State | `src/core/loop/mission-seal.ts` | State management (.opencode/loop-state.json) |
| Seal Detection | `src/core/loop/mission-seal-handler.ts` | Detect `<mission_seal>` in responses |
| Continuation | `src/core/loop/mission-seal-handler.ts` | Inject prompts to continue work |
| Countdown | `src/core/loop/mission-seal-handler.ts` | 3-second countdown toast |
| Idle Handler | `src/plugin-handlers/assistant-done-handler.ts` | Monitor session.idle events |

**Why Event-Driven?**
- No fixed iteration limits - loop continues until sealed
- Resilient to network delays
- Can be interrupted by user at any time
- Efficient polling (500ms interval with backoff)

---

## The 4 Agents

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
| Poll Interval | 500ms | Fast completion detection |
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
- 3-second countdown toast before auto-continuation
- Cancels on user interaction
- Skips if background tasks running or session is recovering

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
- **[Architecture and Flow](docs/ARCHITECTURE_AND_FLOW.md)** — Complete architecture guide with scenarios
- **[Improvement Suggestions](docs/IMPROVEMENT_SUGGESTIONS.md)** — Project improvement recommendations
- [Release Notes](docs/releases/) — Version history

---

## License

MIT License. [LICENSE](LICENSE)

---

<div align="center">
  <b>Enterprise-scale. Memory-safe. Self-healing. Unlimited.</b>
</div>
