#OpenCode Orchestrator Plugin

> **Multi-Agent Plugin for [OpenCode](https://opencode.ai)**

<div align="center">
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/@agnusdei1207/opencode-orchestrator.svg)](https://www.npmjs.com/package/@agnusdei1207/opencode-orchestrator)
[![npm downloads](https://img.shields.io/npm/dt/@agnusdei1207/opencode-orchestrator.svg)](https://www.npmjs.com/package/@agnusdei1207/opencode-orchestrator)
[![OpenCode Plugin](https://img.shields.io/badge/OpenCode-Plugin-purple.svg)](https://opencode.ai)

[English](README.md) | [한국어](README.ko.md) | [简体中文](README.zh.md)
</div>

---

## What is this?

A 6-agent collaborative system that makes even **low-performance models (like GLM-4.7)** act as a highly reliable coding team.

**Core idea**: Break complex tasks into atomic units, verify each step, fix errors automatically.

---

## Why Orchestrator?

| Traditional | With Orchestrator |
|-------------|-------------------|
| One big prompt → Hope it works | Atomic tasks → Verified every step |
| Expensive model required | Fixed, affordable models work |
| Errors compound silently | Self-correcting loop |
| Unpredictable results | **Relentless execution strategy** |

---

- **🧩 Parallel DAG Orchestration** — Concurrent execution of independent tasks
- **🎯 Fixed-Model Optimization** — High reliability even with low-performance LLMs
- **🦀 Rust Core** — Fast, memory-safe search and analysis tools
- **🧠 Micro-Task 2.0** — JSON-based atomic task decomposition
- **🛡️ Style Guardian** — Strict AST-based linting and consistency checks
- **🔄 Self-Healing Loop** — Autonomous pivot strategies for complex errors
- **🏘️ Intelligent Grouping** — Coder + Reviewer pairing for every task
- **🏗️ Rust-Powered Core** — Native performance for heavy lifting

---

## How It Works (Parallel DAG)

Instead of a linear sequence, we use a **Directed Acyclic Graph (DAG)** to model your mission.

```
      Mission Start (/dag)
              │
              ▼
      ┌───────────────┐
      │   PLANNER     │ (Architect)
      └───────┬───────┘
              │
      ┌───────┴───────┐
      │               │ (Parallel Streams)
      ▼               ▼
┌───────────┐   ┌───────────┐
│ Tasks (A) │   │ Tasks (B) │
└─────┬─────┘   └─────┬─────┘
      │               │
      └───────┬───────┘
              ▼
      ┌───────────────┐
      │   REVIEWER    │ (Style Guardian)
      └───────┬───────┘
              ▼
          ✅ MISSION COMPLETE
```

---

## Installation

You can use **npm** or **bun**. Both work perfectly because the core logic runs in a native **Rust binary**.

### Option 1: npm (Standard)
```bash
npm install -g opencode-orchestrator
```

### Option 2: Bun (Fast)
```bash
bun install -g opencode-orchestrator
```

> **Note**: After installation, **restart OpenCode** or run `opencode` in your terminal.
> The plugin will automatically register itself in `~/.config/opencode/opencode.json` with its absolute path.

### Troubleshooting
If the command `/dag` does not appear:
1. Uninstall: `npm uninstall -g opencode-orchestrator` (or `bun remove -g`)
2. Clear config: `rm -rf ~/.config/opencode` (Warning: resets all plugins)
3. Reinstall: `npm install -g opencode-orchestrator`


---

**The only command you need:**

```bash
/dag "Implement user authentication with JWT"
```

The Orchestrator will:
1. **Decompose** the mission into a JSON Task DAG
2. **Parallel Execute** independent streams
3. **Search** proactively for patterns
4. **Code** with atomic precision
5. **Verify** via the Style Guardian (MANDATORY)
6. **Self-Heal** if errors occur

---

## Agents

| Agent | Role |
|-------|------|
| **Orchestrator** | Team leader — coordinates, decides, adapts |
| **Planner** | Breaks work into atomic tasks |
| **Coder** | Implements one task at a time |
| **Reviewer** | Quality gate — catches all errors |
| **Fixer** | Targeted error resolution |
| **Searcher** | Finds context before coding |

---

- [Architecture Deep-Dive](docs/ARCHITECTURE.md) — How the DAG works
- [Configuration](examples/orchestrator.jsonc) — Customize settings

---

## Open Source

MIT License. No telemetry. No backdoors.

[github.com/agnusdei1207/opencode-orchestrator](https://github.com/agnusdei1207/opencode-orchestrator)

---

## Author's Note

> My goal is to prove that **affordable models like GLM-4.7** can produce results as good as expensive APIs — when you structure the work right.
>
> Break tasks down, verify every step, fix errors automatically. The model doesn't need to be smart. The process needs to be disciplined.
>
> — [@agnusdei1207](https://github.com/agnusdei1207)

---

## License

MIT License. NO WARRANTY.

[MIT](LICENSE)

---

## 🏛️ Project Philosophy: Relentless Execution

We don't believe in "fast" AI. We believe in **correct** AI. Our agents are relentless. They don't stop when they hit an error; they pivot, re-plan, and push forward until the goal is achieved.

### The 5-Phase Mission Workflow

1.  **🧠 Phase 1: Deep Analysis (Think First)**: No blind coding. Agents must read documents and summarize the project core boundaries first.
2.  **🌲 Phase 2: Hierarchical Planning**: Decomposition from a high-level architectural vision down to sub-atomic, parallel micro-tasks (JSON DAG).
3.  **� Phase 3: Parallel Execution**: Concurrent execution of independent tasks to maximize efficiency.
4.  **🛡️ Phase 4: Global Sync Gate**: After parallel streams merge, a **Global Consistency Check** ensures all files, imports, and exports stay in perfect sync.
5.  **⏳ Phase 5: Relentless Completion**: No arbitrary time limits. Success is only defined by a 100% verified PASS. We execute as long as it takes to reach perfection.

---

---

## ⚡ Fast-Paced Development

This project is evolving **extremely fast**. We iterate rapidly to bring relentless execution to your workflow.
Updates are frequent. Keep your version fresh.
