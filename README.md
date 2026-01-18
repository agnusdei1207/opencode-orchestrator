<div align="center">
  <img src="assets/logo.png" alt="Logo" width="200" />
</div>

# OpenCode Orchestrator

> **🚀 Multi-Agent Orchestration Plugin for [OpenCode](https://opencode.ai)**

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/opencode-orchestrator.svg)](https://www.npmjs.com/package/opencode-orchestrator)
[![Tests](https://img.shields.io/badge/tests-216%20passed-brightgreen.svg)]()

---

## 🔥 Why This Plugin?

**Budget models have limits. Orchestration breaks them.**

---

## ⚡ Quick Start

```bash
npm install -g opencode-orchestrator
```

Then in OpenCode:

```bash
/task "Build a REST API with authentication"
```

**Done.** You just deployed an army of AI agents. They plan, build, test, fix — and don't stop until it's sealed. ✨

---

## 🎯 What Makes This Different?

### 🚀 Core Capabilities

| | Feature | What It Means |
|:---:|:---|:---|
| ⚡ | **Multi-Session Parallel** | 50 isolated sessions running simultaneously. True multi-threading. |
| 🔥 | **Parallel Execution** | Workers build different files at once. 10x faster. |
| � | **Non-Blocking Async** | Fire-and-forget. Commander never waits. Results collected automatically. |
| 🧩 | **Smart Distribution** | One file = one worker. No conflicts. No stepping on each other. |
| 🔗 | **Real-Time Sync** | Shared `.opencode/` state. All agents see updates instantly. |
| 🛡️ | **Auto Verify & Test** | E2E tests, import checks, integration validation. Bugs get caught. |
| 🩹 | **Self-Healing** | Auto-recovery from crashes, rate limits, context overflow. 3 retries. |
| � | **Live Monitoring** | Track sessions, progress, queues. Toast notifications in real-time. |

---


## 🏛️ How It Works

```
                          YOU
                           │
                           │  /task "Build REST API"
                           ▼
    ╔══════════════════════════════════════════════════════════╗
    ║                   🎯 COMMANDER                           ║
    ║            "I orchestrate. I never sleep."               ║
    ╚══════════════════════════════════════════════════════════╝
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │📋 PLANNER│    │🔨 WORKER │    │🔨 WORKER │    x50 PARALLEL
    │  Plan &  │    │ auth.ts  │    │  api.ts  │    SESSIONS
    │ Research │    │  (TDD)   │    │  (TDD)   │
    └──────────┘    └──────────┘    └──────────┘
          │                │                │
          └────────────────┼────────────────┘
                           ▼
    ╔══════════════════════════════════════════════════════════╗
    ║                   ✅ REVIEWER                            ║
    ║         E2E Tests • Sync Check • Validate                ║
    ╚══════════════════════════════════════════════════════════╝
                           │
                    ┌──────┴──────┐
                    │  Complete?  │
                    └──────┬──────┘
                     No ↙     ↘ Yes
                   ♻️           🎖️
                 LOOP         SEALED
              (auto-fix)    (mission done)
```

---

## 🤖 The 4 Agents

| Agent | Role | Superpower |
|-------|------|------------|
| **🎯 Commander** | Orchestrator | Sees everything, delegates intelligently, never stops |
| **📋 Planner** | Strategist | Web search, doc caching, file-level task breakdown |
| **🔨 Worker** | Builder | TDD isolation, 1 file = 1 session, parallel execution |
| **✅ Reviewer** | Quality Gate | E2E tests, sync checks, integration validation |

---

## 📊 System Specs

| Capability | Value |
|------------|-------|
| **Parallel Sessions** | 50 simultaneous |
| **Concurrency per Agent** | 10 default |
| **Poll Interval** | 1 second |
| **Session TTL** | 60 minutes |
| **Auto-Recovery** | 3 attempts per session |
| **Max Iterations** | 20 per mission |
| **Memory Limit** | 1,000 tasks (auto GC) |

---

## 🎮 What Happens When You Run `/task`

1. **🎯 Commander** reads state, creates TODO
2. **📋 Planner** breaks down into file-level tasks  
3. **🔨 Workers** build in parallel (50 simultaneous sessions!)
4. **✅ Reviewer** validates, runs E2E tests
5. **♻️ Loop** until all TODOs checked + zero issues
6. **🎖️ SEALED** — mission complete

> **Tip:** Stop anytime with `/stop`

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

## 🔧 Self-Healing Features

```
┌────────────────────────────────────────────────────────────┐
│ ERROR TYPE              │ AUTO-RECOVERY ACTION             │
├────────────────────────────────────────────────────────────┤
│ Tool crash              │ Inject recovery prompt           │
│ Rate limit              │ Exponential backoff + retry      │
│ Context overflow        │ Smart compaction                 │
│ Thinking block error    │ Auto-restructure                 │
│ Session timeout         │ Resume from checkpoint           │
│ Build failure           │ Loop back, fix, retry            │
└────────────────────────────────────────────────────────────┘
```

---

## 📚 Documentation

- **[System Architecture](docs/SYSTEM_ARCHITECTURE.md)** — Full technical deep-dive

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
  <h3>🚀 v0.9.7 — "Relentless execution until absolute success."</h3>
  <p><i>Multi-agent. Parallel. Non-blocking. Self-healing. Enterprise-grade.</i></p>
</div>
