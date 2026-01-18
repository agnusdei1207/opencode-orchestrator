<div align="center">
  <img src="assets/logo.png" alt="Logo" width="200" />
</div>

# OpenCode Orchestrator

> Autonomous multi-agent plugin for [OpenCode](https://opencode.ai)

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/opencode-orchestrator.svg)](https://www.npmjs.com/package/opencode-orchestrator)
[![Tests](https://img.shields.io/badge/tests-216%20passed-brightgreen.svg)]()

---

## ⚡ Quick Start

```bash
npm install -g opencode-orchestrator
```

Restart OpenCode after installation. Then:

```bash
/task "Build a REST API with authentication"
```

That's it! The Commander takes over and works until the mission is complete.

---

## 💡 Why I Built This

Budget models have limits. Orchestration breaks them.

---

## 🎯 What is This?

A multi-agent system that **autonomously executes complex tasks** from start to finish. Just describe your mission — the Commander handles everything else.

---

## ✨ v0.9.4 Highlights

> 🚀 **"Relentless execution until absolute success."**

| Category | Feature |
|----------|----------|
| 🛡️ **Resilience** | Never stops. Auto-pivots Plan↔Search on any error |
| ⚡ **Parallelism** | 50 isolated sessions run simultaneously |
| 🔧 **TDD Workers** | Each agent works in complete isolation (1 file = 1 worker) |
| 🔄 **Sync Integration** | Shared `.opencode/` state synchronizes all agents |
| ✅ **Stability Checks** | TODO + Issue verification before mission seal |
| 🧠 **Smart Fixers** | Anti-overengineering: simple errors get simple fixes |

---

## 🚀 How It Works

```
                    /task "Build REST API"
                              │
                              ▼
             ┌────────────────────────────────┐
             │         🎯 COMMANDER           │
             │  Read state → Delegate → Loop  │
             └────────────────────────────────┘
                              │
      ┌───────────────────────┼───────────────────────┐
      ▼                       ▼                       ▼
 ┌─────────┐            ┌─────────┐            ┌─────────┐
 │ PLANNER │            │ WORKER  │            │ WORKER  │    ⚡ PARALLEL
 │ Plan it │            │ Build A │            │ Build B │       EXECUTION
 └─────────┘            └─────────┘            └─────────┘
      │                       │                       │
      └───────────────────────┼───────────────────────┘
                              ▼
             ┌────────────────────────────────┐
             │         ✅ REVIEWER            │
             │       Verify → Sync            │
             └────────────────────────────────┘
                              │
                   ┌──────────┴──────────┐
                   │  TODO incomplete?   │
                   │  Sync issues?       │
                   └──────────┬──────────┘
                        Yes ↓     ↓ No
                    ♻️ LOOP    🎖️ SEALED
```

### 🔑 Core Principles

```
┌─────────────────────────────────────────────────────────────┐
│  🔒 ISOLATION    │  🔄 SYNC       │  ✅ STABILITY          │
├─────────────────────────────────────────────────────────────┤
│  Each worker     │  Shared state  │  TODO 100% complete    │
│  owns 1 file     │  via .opencode │  + Zero sync issues    │
│  No conflicts    │  Real-time     │  = Mission SEALED      │
└─────────────────────────────────────────────────────────────┘
```


---

## 🎮 Usage

| Mode | Trigger | What Happens |
|------|---------|--------------|
| **Commander Mode** 🎯 | `/task "mission"` | Full autonomous execution |
| **Chat Mode** 💬 | Just type normally | Simple Q&A, no automation |

**Example Commands:**
```bash
/task "Fix the login bug in docker-compose"
/task "Add dark mode to the entire app"
/task "Refactor the API to TypeScript"
```

**Stop anytime:** `/stop` or `/cancel`

<div align="center">
  <p><strong>TUI</strong></p>
  <img src="assets/tui_image.png" alt="Commander TUI" width="600" />
</div>

<br />

<div align="center">
  <p><strong>Window</strong></p>
  <img src="assets/window_image.png" alt="Commander Window" width="600" />
</div>
---

## 🤖 The 4 Agents

| Agent | Role | Key Actions |
|-------|------|-------------|
| **Commander** 🎯 | Orchestrator | Delegates tasks, monitors progress, seals mission |
| **Planner** 📋 | Research + Plan | Web search, doc caching, TODO creation |
| **Worker** 🔨 | Implementation | Code writing, file ops, background commands |
| **Reviewer** ✅ | Quality Control | Verification, TODO updates, context management |

---

## 📊 Resource Limits

| Resource | Limit |
|----------|-------|
| Parallel Sessions | 50 |
| Tasks in Memory | 1,000 (auto GC) |
| Session TTL | 60 min |
| Recovery Attempts | 3 per session |
| Max Iterations | 20 per mission |

---

## 📚 Documentation

For detailed architecture, directory structure, and internals:

- **[System Architecture](docs/SYSTEM_ARCHITECTURE.md)** — Complete technical documentation
- [Release Notes](docs/releases/) — Version history

---

## Uninstall

```bash
npm uninstall -g opencode-orchestrator
```

---

## License

MIT License. [LICENSE](LICENSE)

---

<div align="center">
  <b>🚀 v0.9.4 — "Relentless execution until absolute success."</b>
</div>
