<div align="center">
  <img src="assets/starship_approaching_planet.png" alt="logo" width="280" />
  <h1>OpenCode Orchestrator</h1>

  [![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
  [![npm](https://img.shields.io/npm/v/opencode-orchestrator.svg)](https://www.npmjs.com/package/opencode-orchestrator)
  [![Tests](https://img.shields.io/badge/tests-216%20passed-brightgreen.svg)]()
</div>

> **🚀🪐 Multi-Agent Orchestration Plugin for [OpenCode](https://opencode.ai)**

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

## ⭐ Core Philosophy

```
┌───────────────────────────────────────────────────┐
│  🔍 EXPLORE → 📝 LEARN → 🔄 ADAPT → ⚡ ACT          │
│  Scan        Document    Adjust      Execute      │
└───────────────────────────────────────────────────┘
```

---

## 👨‍🚀 The Agents (Crews)

| Agent | Role | What It Does |
|:------|:-----|:-------------|
| 🎯 **Commander** | Orchestrator | Leads the task, delegates work to other agents, ensures completion |
| 📋 **Planner** | Researcher | Analyzes the project, creates the plan, documents findings |
| 🔨 **Worker** | Implementer | Writes code, modifies files, follows the project's patterns |
| ✅ **Reviewer** | Verifier | Tests changes, checks for errors, confirms quality |

---

## 📖 Core Principles

| Principle | What It Means |
|:----------|:--------------|
| 🔍 **Never Assume** | Always check the actual code and config files first |
| 📝 **Document Everything** | Record patterns and findings for future tasks |
| 📚 **Verify with Evidence** | Run tests, cite sources, complete with proof |
| 🔄 **Adapt to the Project** | Match the project's existing style and patterns |
| 🤝 **Specialized Roles** | Each agent has a clear, focused responsibility |

---

## 🏛️ Workflow

```
        /task "Build REST API"
                │
    ╔═══════════════════════════════════╗
    ║  🎯 COMMANDER — "Start the task"  ║
    ╚═══════════════╤═══════════════════╝
                    │
    ┌───────────────┼───────────────┐
    ▼               ▼               ▼
┌───────┐      ┌───────┐      ┌───────┐
│PLANNER│      │WORKER │      │WORKER │   ← 🔥 50 PARALLEL
│plan.md│      │auth.ts│      │api.ts │      TASKS
└───────┘      └───────┘      └───────┘
    │               │               │
    └───────────────┼───────────────┘
                    ▼
    ╔═══════════════════════════════════╗
    ║  ✅ REVIEWER — "Verify everything"║
    ╚═══════════════╤═══════════════════╝
                    │
           ┌────────┴────────┐
           │ TODO 100%?      │
           │ Issues = 0?     │
           └────────┬────────┘
             No ↙       ↘ Yes
          ♻️ LOOP      ✅ COMPLETE
```

## Features

| Feature | What It Does |
|:---------|:-------------|
| ⚡ **50 Parallel Tasks** | Run up to 50 agents simultaneously |
| 🔥 **Multi-File Operations** | Work on different files at the same time |
| 🧩 **Smart Assignment** | One file = one agent. No conflicts |
| 🔗 **Real-Time Sync** | Shared `.opencode/` state keeps all agents in sync |
| 🛡️ **Automatic Verification** | E2E tests, import checks, integration validation |
| 🩹 **Auto-Recovery** | Retry failed tasks automatically (up to 3 times) |
| 🧬 **Adaptive AI** | Agents learn and adapt based on the project |

---

## 🚨 Error Handling

| Error | What Happens |
|:------|:-------------|
| 💥 Tool crash | Inject recovery prompt and retry |
| 🚦 Rate limit hit | Wait and retry with exponential backoff |
| 📦 Context overflow | Compact the context automatically |
| ⏱️ Session timeout | Resume from the last checkpoint |
| 🔨 Build failure | Fix the issue and retry |

---

## 📚 Documentation

- **[System Architecture](docs/SYSTEM_ARCHITECTURE.md)** — Full technical deep-dive

---

## 🎹 Developer's Words

> [Read the full note →](docs/DEVELOPERS_NOTE.md)

---

## 📄 License

MIT License. [LICENSE](LICENSE)
