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

> **Imagine humanity landing on an unknown planet.**  
> No maps. No guides. Just raw terrain and a mission to complete.

This is how our agents approach every project.

### 🌍 The New World Protocol

When you arrive on an uncharted world, you don't assume oxygen. You don't guess gravity. You **explore**, **learn**, **adapt**, and then **act**.

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                      │
│  🔍 EXPLORE    →    📝 LEARN    →    🔄 ADAPT    →    ⚡ ACT                          │
│                                                                                      │
│  Scan the          Document           Adjust to          Execute the                │
│  unknown           discoveries        the terrain        mission                    │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### � The Crew

**🎯 Commander** — *The captain who landed the ship*

> Arrived on foreign soil with one mission: complete the objective. Doesn't know the atmosphere yet, doesn't know what grows here. But knows how to lead. Scans the horizon, delegates specialists, and keeps the mission moving until it's sealed.

**📋 Planner** — *The scientist who maps the terrain*

> First out of the ship with instruments in hand. Tests the soil, analyzes the air, documents every discovery. Creates the maps that everyone will follow. Without the Planner's records, the crew would be lost.

**🔨 Worker** — *The engineer who builds the base*

> Takes the Planner's maps and builds. Adapts construction to local materials. If the terrain is rocky, builds on rock. If it's sandy, adjusts foundations. Doesn't fight the environment — works with it.

**✅ Reviewer** — *The inspector who clears for launch*

> Before the mission can be called complete, everything must pass inspection. Walks the perimeter, tests the structures, verifies against the original blueprints. Only when every check passes does the mission get sealed.

### 🛸 The Protocol

| Phase | The Crew's Action |
|:------|:------------------|
| 🔍 **EXPLORE** | *"What kind of world is this?"* — Scan environment, detect patterns, never assume |
| � **LEARN** | *"Let me write this down."* — Document findings for the team and future missions |
| � **ADAPT** | *"We'll do it this way here."* — Adjust approach to fit what we've learned |
| ⚡ **ACT** | *"Execute."* — Build, test, verify, seal the mission |

### 🌟 Crew Principles

| Principle | In Practice |
|:----------|:------------|
| 🔍 **Never Assume Gravity** | Read `context.md`, detect stack, find actual commands |
| 📝 **Document for Future Missions** | Record patterns, conventions, and findings for reuse |
| 📚 **Evidence Over Memory** | Cite docs, run commands, complete only with proof |
| 🔄 **Adapt to the Terrain** | Behavior evolves based on what we've documented |
| 🤝 **Each Crew Member Has a Role** | Specialists don't overlap — they collaborate |

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
