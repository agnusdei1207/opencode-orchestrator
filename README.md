<div align="center">
  <img src="assets/logo.png" alt="Logo" width="200" />
</div>

# OpenCode Orchestrator 🎯

> **Enterprise-Grade Autonomous Multi-Agent Plugin for [OpenCode](https://opencode.ai)**

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/opencode-orchestrator.svg)](https://www.npmjs.com/package/opencode-orchestrator)
[![Tests](https://img.shields.io/badge/tests-211%20passed-brightgreen.svg)]()

---

## 🚀 What's New in v0.6.0

**Ultimate Agent Architecture** - Production-ready distributed agent orchestration!

| Feature | Description |
|---------|-------------|
| **♾️ Unlimited Mode** | No step limits - runs until mission complete |
| **🧠 Anti-Hallucination** | Research before coding, verify with docs |
| **⚡ 50x Parallel Sessions** | Massive concurrent task execution |
| **📊 Auto Memory Management** | GC, archiving, zero memory leaks |
| **🔄 Auto Recovery** | Handles rate limits, errors automatically |
| **📡 Event-Driven** | Real-time pub/sub across all components |

---

## ⚡ Why This Architecture?

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     ORCHESTRATOR ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   User Request                                                           │
│        │                                                                 │
│        ▼                                                                 │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    PARENT SESSION                                │   │
│   │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐             │   │
│   │  │Commander│─▶│Architect│─▶│ Builder │─▶│Inspector│             │   │
│   │  └─────────┘  └─────────┘  └────┬────┘  └─────────┘             │   │
│   │                                 │                                │   │
│   │                    launch_parallel_agent()                       │   │
│   └─────────────────────────────────┼───────────────────────────────┘   │
│                                     │                                    │
│   ┌─────────────────────────────────▼───────────────────────────────┐   │
│   │              PARALLEL SESSION POOL (up to 50 concurrent)         │   │
│   │  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐   │   │
│   │  │Task 1 │ │Task 2 │ │Task 3 │ │Task 4 │ │Task 5 │ │ ...   │   │   │
│   │  │Builder│ │Research││Library│ │Builder│ │Inspect│ │       │   │   │
│   │  └───┬───┘ └───┬───┘ └───┬───┘ └───┬───┘ └───┬───┘ └───────┘   │   │
│   │      │         │         │         │         │                   │   │
│   └──────┼─────────┼─────────┼─────────┼─────────┼──────────────────┘   │
│          │         │         │         │         │                       │
│   ┌──────▼─────────▼─────────▼─────────▼─────────▼──────────────────┐   │
│   │                        EVENT BUS                                 │   │
│   │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │   │
│   │  │task.start│ │task.done │ │session.* │ │mission.* │            │   │
│   │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘            │   │
│   └───────┼────────────┼────────────┼────────────┼──────────────────┘   │
│           │            │            │            │                       │
│   ┌───────▼────────────▼────────────▼────────────▼──────────────────┐   │
│   │                     CORE SYSTEMS                                 │   │
│   │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │   │
│   │  │ Toast   │ │Progress │ │Recovery │ │ Cache   │ │ Context │   │   │
│   │  │Notifier │ │ Tracker │ │ Manager │ │ Manager │ │ Sharing │   │   │
│   │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 🎯 Key Differentiators

| Capability | OpenCode Orchestrator | Basic Plugins |
|------------|----------------------|---------------|
| **Parallel Sessions** | Up to 50 concurrent | Single session |
| **Memory Management** | Auto GC + disk archiving | Memory leaks |
| **Error Recovery** | Pattern-based auto retry | Crash |
| **Context Sharing** | Parent-child merge | Isolated |
| **Event System** | Real-time pub/sub | None |
| **Task Decomposition** | 3-level hierarchy | Flat |

---

## Installation

```bash
npm install -g opencode-orchestrator
```

Restart OpenCode after installation.

---

## Usage

### 🚀 Select Commander via Tab Key (Recommended)

Press `Tab` in OpenCode → Select **Commander** → Type your mission!

<div align="center">
  <img src="assets/tui_image.png" alt="Commander TUI" width="600" />
  <p><sub><b>Commander</b> agent selection interface in OpenCode (TUI)</sub></p>

  <br/> <img src="assets/window_image.png" alt="Commander Windows" width="600" />
  <p><sub>Execution of <b>Commander</b> agent on Windows environment</sub></p>
</div>

```
"Fix the login bug in the docker-compose environment"
```

### 📋 Use /task Command

```bash
/task "Implement user authentication with JWT"
```

> **💡 Tip:** Both regular messages and `/task` now run in **unlimited mode** by default!

---

## The 7 Agents

| Agent            | Role         | Responsibility                     |
| :--------------- | :----------- | :--------------------------------- |
| **Commander** 🎯 | Orchestrator | Autonomous mission control         |
| **Architect** 🏗️ | Planner      | Hierarchical task decomposition    |
| **Builder** 🔨   | Developer    | Full-stack implementation          |
| **Inspector** 🔍 | Quality      | Audit, auto-fix & doc verification |
| **Recorder** 💾  | Context      | Progress tracking                  |
| **Librarian** 📚 | Research     | Documentation & API research       |
| **Researcher** 🔬 | Investigation | Pre-task research & analysis      |

---

## 🏗️ Core Systems Architecture

### 📡 Event Bus - Real-time Communication

```typescript
// Every component communicates via events
EventBus.subscribe(TASK_EVENTS.COMPLETED, (event) => {
    Toast.show({ title: "Task Done!", message: event.taskId });
    ProgressTracker.recordSnapshot(sessionId, { completed: true });
});

// Fire and forget
EventBus.emit(TASK_EVENTS.STARTED, { taskId, agent: "builder" });
```

### ⚡ Parallel Session Manager

```
┌────────────────────────────────────────────────────┐
│              ParallelAgentManager                   │
├────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐             │
│  │ TaskLauncher │    │ TaskResumer  │             │
│  │ Create new   │    │ Resume paused│             │
│  │ sessions     │    │ sessions     │             │
│  └──────┬───────┘    └──────────────┘             │
│         │                                          │
│  ┌──────▼───────┐    ┌──────────────┐             │
│  │ TaskPoller   │    │ TaskCleaner  │             │
│  │ Detect done  │    │ GC + Archive │             │
│  │ (1s interval)│    │ (auto)       │             │
│  └──────────────┘    └──────────────┘             │
│                                                    │
│  ┌─────────────────────────────────────────────┐  │
│  │           ConcurrencyController              │  │
│  │  • Default: 10 concurrent per agent type    │  │
│  │  • Maximum: 50 total parallel sessions      │  │
│  │  • Queue overflow: Auto-wait                │  │
│  └─────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

### 🛡️ Auto Recovery System

```
Error Detected
      │
      ▼
┌─────────────────────────────────────────┐
│           Pattern Matcher               │
│  • /rate.?limit/ → Retry + Backoff     │
│  • /token.?limit/ → Compact context    │
│  • /network/ → Retry 3x                │
│  • /parse.?error/ → Skip               │
└─────────────────────────────────────────┘
      │
      ▼
   Recover
```

### 💾 Memory Management

```
┌─────────────────────────────────────────┐
│           TaskStore GC                  │
├─────────────────────────────────────────┤
│  MAX_TASKS_IN_MEMORY: 1000             │
│  MAX_NOTIFICATIONS: 100/parent          │
│                                         │
│  Auto Cleanup:                          │
│  • Completed > 30min → Archive to disk  │
│  • Failed > 10min → Delete              │
│  • Over limit → Trigger GC              │
│                                         │
│  Archive Location:                      │
│  .cache/task-archive/tasks_YYYY-MM-DD   │
└─────────────────────────────────────────┘
```

---

## 🛠️ Available Tools

| Tool | Description |
|------|-------------|
| `call_agent` | Call another agent synchronously |
| `launch_parallel_agent` | Start parallel async session |
| `check_parallel_task` | Check task status |
| `collect_parallel_results` | Gather completed results |
| `webfetch` | Fetch URL content as Markdown |
| `websearch` | Search web (SearXNG → Brave → DuckDuckGo) |
| `codesearch` | Search open source code patterns |
| `cache_docs` | Manage cached documentation |
| `run_background` | Run command in background |
| `grep_search` / `glob_search` | Fast file search |

---

## 📊 Resource Guarantees

| Resource | Limit | Safety Mechanism |
|----------|-------|------------------|
| Parallel Sessions | 50 | Queue overflow protection |
| Tasks in Memory | 1,000 | Auto GC + disk archive |
| Notifications | 100/parent | FIFO eviction |
| Event History | 100 | Ring buffer |
| Session TTL | 60 min | Auto cleanup |

---

## 🧪 Test Coverage

```
Test Files:  18 passed
Tests:       211 passed
Duration:    ~4.3s

Modules Tested:
• Event Bus (11 tests)
• Document Cache (8 tests)
• Progress Tracker (12 tests)
• Auto Recovery (10 tests)
• Task Decomposer (12 tests)
• Shared Context (10 tests)
• Integration (9 tests)
• ...and more
```

---

## Uninstall

```bash
npm uninstall -g opencode-orchestrator
```

---

## Documentation

- **[System Architecture](docs/SYSTEM_ARCHITECTURE.md)** — Complete system flow diagrams
- [Component Architecture](docs/ARCHITECTURE.md)
- [Release Notes](docs/releases/) — Version history
- [Troubleshooting](docs/PLUGIN_TROUBLESHOOTING.md)

---

## License

MIT License. [LICENSE](LICENSE)

---

<div align="center">
  <b>Enterprise-scale. Memory-safe. Self-healing. Unlimited.</b>
</div>
