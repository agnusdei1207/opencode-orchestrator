<div align="center">
  <img src="assets/starship.png" alt="STARSHIP" width="280" />
  <h1>OpenCode Orchestrator</h1>

  [![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
  [![npm](https://img.shields.io/npm/v/opencode-orchestrator.svg)](https://www.npmjs.com/package/opencode-orchestrator)
  [![Tests](https://img.shields.io/badge/tests-216%20passed-brightgreen.svg)]()
</div>

---

> The STARSHIP lands on a new planet: an unfamiliar codebase. No docs. No tests. Just a mission. The crew doesn't ask — they explore, adapt, and conquer.

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

## 🛸 Protocol

```
┌───────────────────────────────────────────────────┐
│  🔍 EXPLORE → 📝 LEARN → 🔄 ADAPT → ⚡ ACT          │
│  Scan        Document    Adjust      Execute      │
└───────────────────────────────────────────────────┘
```

### 👨‍🚀 The Crew

*When the STARSHIP arrives, four specialists deploy:*

| Agent | Role | Mission |
|:------|:-----|:--------|
| 🎯 **Commander** | The Captain | *"I lead the mission. I delegate. I don't leave until it's done."* |
| 📋 **Planner** | The Scientist | *"I map the terrain. I document everything. I create paths to follow."* |
| 🔨 **Worker** | The Engineer | *"I build with local materials. I adapt to what I find."* |
| ✅ **Reviewer** | The Inspector | *"Nothing launches until I verify it. Zero defects."* |

### 📖 The Codex

*These are the rules every crew member lives by:*

| Principle | In Practice |
|:----------|:------------|
| 🔍 **Never Assume Gravity** | Read `context.md`, detect stack, find actual commands |
| 📝 **Document for Future Missions** | Record patterns, conventions, and findings for reuse |
| 📚 **Evidence Over Memory** | Cite docs, run commands, complete only with proof |
| 🔄 **Adapt to the Terrain** | Behavior evolves based on what we've documented |
| 🤝 **Each Crew Member Has a Role** | Specialists don't overlap — they collaborate |

---

## 🏛️ Mission Control


```
        /task "Build REST API"
                │
    ╔═══════════════════════════════════╗
    ║  🎯 COMMANDER — "Deploy the crew" ║
    ╚═══════════════╤═══════════════════╝
                    │
    ┌───────────────┼───────────────┐
    ▼               ▼               ▼
┌───────┐      ┌───────┐      ┌───────┐
│PLANNER│      │WORKER │      │WORKER │   ← 🔥 50 PARALLEL
│plan.md│      │auth.ts│      │api.ts │      DEPLOYMENTS
└───────┘      └───────┘      └───────┘
    │               │               │
    └───────────────┼───────────────┘
                    ▼
    ╔═══════════════════════════════════╗
    ║  ✅ REVIEWER — "Final inspection" ║
    ╚═══════════════╤═══════════════════╝
                    │
           ┌────────┴────────┐
           │ TODO 100%?      │
           │ Issues = 0?     │
           └────────┬────────┘
             No ↙       ↘ Yes
          ♻️ LOOP      🎖️ MISSION SEALED
```

---

## 🚀 Capabilities

| Capability | What It Means |
|:-----------|:--------------|
| ⚡ **50 Parallel Deployments** | Deploy up to 50 crew members simultaneously |
| 🔥 **Multi-Zone Operations** | Workers build different sectors at the same time |
| 🧩 **Smart Crew Assignment** | One file = one specialist. Zero conflicts |
| 🔗 **Real-Time Comms** | Shared `.opencode/` state syncs all agents |
| 🛡️ **Pre-Launch Verification** | E2E tests, import checks, integration validation |
| 🩹 **Self-Repair Systems** | Auto-recovery with 3 retries per session |
| 🧬 **Adaptive AI Cores** | Agents evolve based on what they discover |

### 🚨 Emergency Protocols

*When things go wrong in space, the STARSHIP knows what to do:*

| Emergency | Recovery Action |
|:----------|:----------------|
| 💥 Tool crash | Inject recovery prompt |
| 🚦 Rate limit hit | Exponential backoff + retry |
| 📦 Context overflow | Smart compaction |
| ⏱️ Session timeout | Resume from checkpoint |
| 🔨 Build failure | Loop back, fix, retry |

---

## 📚 Documentation

- **[System Architecture](docs/SYSTEM_ARCHITECTURE.md)** — Full technical deep-dive

---

## 🎹 Developer's Words

> [Read the full note →](docs/DEVELOPERS_NOTE.md)

---

## 📄 License

MIT License. [LICENSE](LICENSE)
