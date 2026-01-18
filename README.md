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

> **Explore → Learn → Adapt → Act**  
> *Like a human exploring unknown space — discover, document, adjust, execute.*

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                      │
│  🔍 EXPLORE    →    📝 LEARN    →    🔄 ADAPT    →    ⚡ ACT                          │
│                                                                                      │
│  Scan unknown       Document           Adjust             Execute with               │
│  territory          discoveries        behavior           confidence                 │
│                                                                                      │
│  • Read context     • Record patterns  • Match style      • Build it                 │
│  • Detect stack     • Note conventions • Fit the project  • Test it                  │
│  • Find commands    • Log findings     • Apply learnings  • Seal it                  │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### 🛸 The Astronaut Principle

Agents behave like astronauts landing on unknown planets:

- **Never assume gravity** — Always detect the environment first
- **Document everything** — Record discoveries for future missions
- **Adapt to atmosphere** — Adjust behavior based on learnings  
- **Act with confidence** — Execute precisely once the terrain is mapped

This is **real-time adaptation**. Not pre-programmed scripts, but **living intelligence that transforms based on context**.

### 🎭 Agents & Their Adaptive Behavior

| Agent | Mission | Adaptive Behavior |
|:-----:|:--------|:------------------|
| 🎯 **Commander** | Orchestration | Discover project reality → Delegate dynamically → Loop until sealed |
| 📋 **Planner** | Strategy | Research actual docs → Plan parallel paths → Document findings |
| 🔨 **Worker** | Implementation | Observe patterns → Learn conventions → Implement with fit |
| ✅ **Reviewer** | Verification | Read real standards → Run actual tests → Approve with evidence |

### Guiding Principles

| Principle | Adaptive Practice |
|:----------|:------------------|
| 🔍 **Discover, Don't Assume** | Read `context.md`, detect stack, find actual commands |
| 📝 **Learn & Document** | Record patterns, conventions, and findings for reuse |
| 📚 **Evidence Over Memory** | Cite docs, run commands, complete only with proof |
| 🔄 **Transform with Context** | Behavior evolves based on documented learnings |
| 🤝 **Separation of Concerns** | Each agent masters one domain excellently |

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
| 🧬 **Adaptive Intelligence** | Agents evolve behavior based on discoveries |

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

## 🎹 Developer's Words

<div align="center">
  <img src="assets/image.png" alt="Piano and Code" width="600" />
</div>

<br />

> *I believe playing the piano is also a form of orchestration.*
>
> *The harmony of polyphony — multiple voices — and homophony — a single melodic line.*
>
> *Each voice sings its most beautiful song from its own place, yet when combined, they create one grand, beautiful melody. I believe this structure is no different from AI agents.*


---

## 📄 License

MIT License. [LICENSE](LICENSE)
