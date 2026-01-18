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

## 🧠 Core Philosophy

> **Explore → Adapt → Act**  
> *Never assume. Always verify. Then execute.*

### The Problem with AI Agents

Most AI agents fail because they:
- **Assume** instead of checking
- **Guess** instead of researching  
- Follow **rigid rules** instead of adapting
- Trust **memory** instead of verifying

### Our Solution: Adaptive Intelligence

Every agent in this system follows a simple principle:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   🔍 EXPLORE    →    🔄 ADAPT    →    ⚡ ACT               │
│                                                             │
│   Discover         Adjust to         Execute with           │
│   the reality      what you find     confidence             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Agent Philosophies

| Agent | Philosophy | What It Means |
|:-----:|:-----------|:--------------|
| 🎯 **Commander** | Explore → Adapt → Act | Discover project structure first, then delegate intelligently |
| 📋 **Planner** | Research → Plan → Document | Never guess syntax. Find official docs, verify, then plan |
| 🔨 **Worker** | Observe → Learn → Implement | Study existing code patterns, then write code that fits |
| ✅ **Reviewer** | Understand → Verify → Approve | Know the project's standards, run actual tests, approve with evidence |

### Guiding Principles

1. **🔍 Never Assume, Always Discover**
   - Read `context.md` before every action
   - Detect the tech stack, don't assume it
   - Find the build/test commands, don't guess them

2. **📚 Evidence Over Memory**
   - Cite official documentation for every claim
   - Run actual commands for verification
   - Mark complete only with proof

3. **🔄 Adapt to the Project**
   - Match existing code patterns
   - Follow discovered conventions
   - Respect the project's way of doing things

4. **🤝 Separation of Concerns**
   - Commander orchestrates, never implements
   - Worker builds, never verifies
   - Reviewer approves, never codes
   - Each agent does one thing excellently

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

> **⚡ DELEGATE. PARALLELIZE. SEAL.** — One command unleashes full autonomous execution.

```
            /task "Build REST API"
                     │
     ╔═══════════════╧═══════════════╗
     ║  🎯 COMMANDER — Delegate+Loop ║
     ╚═══════════════╤═══════════════╝
                     │
     ┌───────────────┼───────────────┐
     ▼               ▼               ▼
 ┌───────┐      ┌───────┐      ┌───────┐
 │PLANNER│      │WORKER │      │WORKER │   ← 🔥 50 PARALLEL
 │plan.md│      │auth.ts│      │api.ts │      SESSIONS
 └───────┘      └───────┘      └───────┘
     │               │               │
     └───────────────┼───────────────┘
                     ▼
     ╔═══════════════╧═══════════════╗
     ║      ✅ REVIEWER — Verify     ║
     ╚═══════════════╤═══════════════╝
                     │
            ┌────────┴────────┐
            │ TODO 100%?      │
            │ Issues = 0?     │
            └────────┬────────┘
              No ↙       ↘ Yes
            ♻️ LOOP      🎖️ SEALED
```

### 🔑 Key Systems

| System | What It Does |
|:------:|:-------------|
| **🔀 Multi-Session** | `delegate_task` → `client.session.create()` → new isolated session |
| **⚡ Parallel Agents** | 50 sessions run simultaneously, `ConcurrencyController` manages slots |
| **🖥️ Background Tasks** | `run_background` → async shell commands, non-blocking |
| **🔄 Auto-Continuation** | `session.idle` → check TODOs → inject prompt → keep going |
| **🛡️ Self-Healing** | Rate limits, crashes → 3 auto-retries per session |

> **Stop anytime:** `/stop`

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

