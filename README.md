<div align="center">
  <img src="assets/logo.png" alt="Logo" width="200" />
</div>

# OpenCode Orchestrator

> **🚀 Multi-Agent Orchestration Plugin for [OpenCode](https://opencode.ai)**

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/opencode-orchestrator.svg)](https://www.npmjs.com/package/opencode-orchestrator)
[![Tests](https://img.shields.io/badge/tests-216%20passed-brightgreen.svg)]()

---

## ⚡ Quick Start

```bash
npm install -g opencode-orchestrator
```

Then in OpenCode:
```bash
/task "Build a REST API with authentication"
```

---

## 🧠 Core Philosophy

> **Explore → Adapt → Act**  
> *Never assume. Always verify. Then execute.*

```
┌───────────────────────────────────────────────────────────┐
│                                                           │
│   🔍 EXPLORE    →    🔄 ADAPT    →    ⚡ ACT             │
│                                                           │
│   Discover          Adjust to         Execute with        │
│   the reality       what you find     confidence          │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### Agents & Their Philosophy

| Agent | Role | Philosophy |
|:-----:|:-----|:-----------|
| 🎯 **Commander** | Orchestrator | Discover project → Delegate intelligently → Loop until sealed |
| 📋 **Planner** | Strategist | Research docs → Plan with parallelism → Document findings |
| 🔨 **Worker** | Implementer | Observe patterns → Learn conventions → Implement with fit |
| ✅ **Reviewer** | Gatekeeper | Read standards → Run tests → Approve with evidence |

### Guiding Principles

| Principle | Practice |
|:----------|:---------|
| 🔍 **Discover, Don't Assume** | Read `context.md`, detect tech stack, find build/test commands |
| 📚 **Evidence Over Memory** | Cite docs, run actual commands, complete only with proof |
| 🔄 **Adapt to the Project** | Match existing patterns, follow discovered conventions |
| 🤝 **Separation of Concerns** | Each agent does one thing excellently |

---

## 🏛️ Architecture

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

---

## ✨ Key Features

| Feature | Description |
|:--------|:------------|
| ⚡ **50 Parallel Sessions** | True multi-threading with isolated contexts |
| 🔥 **Parallel File Builds** | Workers build different files simultaneously |
| 🧩 **Smart Distribution** | One file = one worker. No conflicts |
| 🔗 **Real-Time Sync** | Shared `.opencode/` state across all agents |
| 🛡️ **Auto Verification** | E2E tests, import checks, integration validation |
| 🩹 **Self-Healing** | Auto-recovery with 3 retries per session |

### Self-Healing Details

| Error Type | Recovery Action |
|:-----------|:----------------|
| Tool crash | Inject recovery prompt |
| Rate limit | Exponential backoff + retry |
| Context overflow | Smart compaction |
| Session timeout | Resume from checkpoint |
| Build failure | Loop back, fix, retry |

---

## 📸 Screenshots

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

## 📚 Documentation

- **[System Architecture](docs/SYSTEM_ARCHITECTURE.md)** — Full technical deep-dive

---

## 🗑️ Uninstall

```bash
npm uninstall -g opencode-orchestrator
```

---

## 📄 License

MIT License. [LICENSE](LICENSE)
