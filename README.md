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

After subscribing to GLM-4.7, I was disappointed by its standalone performance.

But I realized: **the model isn't the bottleneck — the workflow is.**

With proper orchestration — structured prompts, parallel execution, TODO-driven loops, and auto-recovery — even budget-tier models can rival premium ones.

This plugin exists to prove that **orchestration > raw model power**.

---

## 🎯 What is This?

A multi-agent system that **autonomously executes complex tasks** from start to finish. Just describe your mission — the Commander handles everything else.

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| 🤖 **4 Specialized Agents** | Commander → Planner → Worker → Reviewer, each with distinct roles |
| ⚡ **Parallel Execution** | Up to 50 concurrent sessions — no waiting, maximum throughput |
| 🔄 **Background Tasks** | Long-running commands (npm install, tests) run non-blocking |
| 📋 **TODO-Driven Completion** | Auto-continues until every TODO is checked — never stops halfway |
| 🛡️ **Auto-Recovery** | Handles errors, rate limits, and session crashes automatically |
| 💾 **Memory Safety** | Auto GC, disk archiving, 60-min TTL — no memory leaks |
| 🔔 **Smart Notifications** | Consolidated task toasts with progress tracking |

---

## 🚀 How It Works

```
👤 You: /task "Build a REST API with authentication"
                              │
                              ▼
              ┌───────────────────────────────┐
              │      🎯 COMMANDER             │ ← Master Session
              │   Creates TODO, delegates     │
              └───────────────────────────────┘
                              │
       ┌──────────────────────┼──────────────────────┐
       ▼                      ▼                      ▼
  ┌─────────┐           ┌─────────┐           ┌─────────┐
  │ PLANNER │           │ WORKER  │           │ WORKER  │
  │ ses_001 │           │ ses_002 │           │ ses_003 │   ⚡ PARALLEL
  └─────────┘           └─────────┘           └─────────┘      SESSIONS
       │                      │                      │
       │    ┌─────────────────┴─────────────────┐    │
       │    │  🔄 Background: npm install, test │    │   ⏳ NON-BLOCKING
       │    └───────────────────────────────────┘    │
       └──────────────────────┼──────────────────────┘
                              ▼
              ┌───────────────────────────────┐
              │      ✅ REVIEWER              │
              │   Verifies, updates TODOs     │
              └───────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │  TODOs remain?    │
                    └─────────┬─────────┘
                        Yes ↓     ↓ No
                     ♻️ LOOP    🎖️ SEALED
                      BACK       (done!)
```

**♾️ Runs until complete** — Keeps looping until ALL TODOs are checked, then seals the mission.

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
  <b>Enterprise-scale. Memory-safe. Self-healing. Unlimited.</b>
</div>
