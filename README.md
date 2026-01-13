# OpenCode Orchestrator Plugin

> **Multi-Agent Plugin for [OpenCode](https://opencode.ai)**

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/opencode-orchestrator.svg)](https://www.npmjs.com/package/opencode-orchestrator)
[![npm downloads](https://img.shields.io/npm/dt/opencode-orchestrator.svg)](https://www.npmjs.com/package/opencode-orchestrator)
[![OpenCode Plugin](https://img.shields.io/badge/OpenCode-Plugin-purple.svg)](https://opencode.ai)

[English](README.md) | [한국어](docs/README/README.ko.md) | [简体中文](docs/README/README.zh.md) | [日本語](docs/README/README.ja.md) | [Español](docs/README/README.es.md) | [Français](docs/README/README.fr.md) | [Deutsch](docs/README/README.de.md)
[Русский](docs/README/README.ru.md) | [Português](docs/README/README.pt.md)

---

<p align="center">
  <img src="assets/logo.png" width="600" />
</p>

> **The Ultimate Goal**
>
> To decompose tasks into such microscopic, easy-to-solve units that **even a 'fool' can execute them**, enabling **massive parallel collaboration**. The model doesn't need to be smart. **The collaborative method needs to be perfect.**

---

## What is this?

A 6-agent collaborative system that maximizes **Agent Orchestration** to extract **Ultimate Decision Quality** from **affordable, lower-performance models**.

**Core Idea**: Through strategic role allocation, microscopic task decomposition, and rigid validation enforcement, we achieve **State-of-the-Art (SOTA) results** using **cost-effective models**. Even if the underlying model is not 'smartest', our architecture ensures it **gets the job done** flawlessly.

---

## Why Orchestrator?

| Traditional | With Orchestrator |
|-------------|-------------------|
| Expensive "Smart" Model required | **Affordable Model + Smart Process** |
| High Token Costs (Huge Context) | **Token Efficient** (Filtered Context) |
| Linear, Slow Execution | **Parallel, Fast Execution** |
| Errors compound silently | **Self-Correcting Verification Loops** |
| "Hope it works" | **Strategic Micro-Tasking** |

---

- **🧩 Strategic Organization** — Maximizing output through intelligent role distribution
- **📉 Token Economy** — Filtering noise to reduce costs and increase focus
- **⚡ Parallel DAG** — Concurrent execution for speed and efficiency
- **🔍 Micro-Tasking** — Atomic decomposition to prevent hallucinations
- **🛡️ Style Guardian** — Strict AST-based linting and consistency checks
- **🔄 Self-Healing** — Autonomous pivot strategies for complex errors
- **🏗️ Rust Core** — Native performance for heavy lifting

---

## How It Works (Parallel DAG)

Instead of a linear sequence, we use a **Directed Acyclic Graph (DAG)** to model your mission.

```
      Mission Start (/task)
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

- **[System Architecture (Deep Dive)](docs/ARCHITECTURE.md)**: Explore the Distributed Cognitive Architecture (DCA), PDCA Loop, and Actor Model internals.
- **[Configuration](docs/CONFIGURATION.md)**: `opencode.toml` setup guide.

---

## Open Source

MIT License. No telemetry. No backdoors.

[github.com/agnusdei1207/opencode-orchestrator](https://github.com/agnusdei1207/opencode-orchestrator)

---

## License

MIT License. NO WARRANTY.

[MIT](LICENSE)

---

## 🏛️ The Architecture: The PDCA & Distributed Cognitive Loop

We have moved beyond simple "chatbots". **OpenCode Orchestrator** implements a **Deterministic Engineering Layer** built on top of the stochastic nature of LLMs,
- **Strict PDCA Loop**: Guarantees quality via Plan-Do-Check-Act cycle.
- **🔍 Micro-tasking**: Atomic decomposition to prevent hallucinations.
- **🛡️ Style Guardian**: Strict AST-based linting and consistency checks by the Reviewer.
- **🔄 Self-healing**: Autonomous pivoting strategies for complex errors.
- **Distributed Cognitive System**: Intelligence layer acting like an OS Kernel.
- **File-Based State**: Uses physical filesystem as RAM, ignoring context limits.
We treat agents as **Semantic Compute Units**. By applying rigorous Computer Science principles, we achieve a level of reliability that no single model can match.

### 🧬 The "Grand Fusion" of Methodologies
We explicitly fused three massive domains into one seamless workflow:

1.  **PDCA Methodology (Quality Assurance)**:
    *   **Plan (Planner)**: Recursively decomposes mission into atomic tasks ($O(log n)$).
    *   **Do (Coder)**: Executes the atomic tasks in parallel (Distributed Actions).
    *   **Check (Reviewer)**: Acts as a **Byzantine Fault Tolerance** node, strictly validating code against requirements.
    *   **Act (Orchestrator)**: Merges successful states or **Pivots** (Dynamic Programming) if failures occur.

2.  **Distributed Systems Theory (Actor Model)**:
    *   Each agent operates as an independent **Actor** with isolated state.
    *   **Context Sharding**: We treat context windows like RAM, paging data in/out via `temp_context` files to simulate **Infinite Context**.

3.  **Algorithmic Efficiency**:
    *   **Divide & Conquer**: Breaking complex problems into trivial $O(1)$ sub-problems.
    *   **Dynamic Programming**: Storing intermediate results (State) to avoid redundant computation and allow for intelligent backtracking.

### 🚀 The Command: `/task`

The interface to this system is a single, powerful command:

```bash
/task "Refactor the authentication middleware and implement JWT rotation"
```

This triggers the **Distributed Task Loop**. It's not just a chat; it's a mission commitment.

### The 5-Phase Efficiency Workflow

1.  **🧠 Phase 1: Filtered Analysis**: The **Searcher** reads docs but filters out noise. We only feed the "critical path" to the Planner.
2.  **🌲 Phase 2: Strategic Planning**: The **Planner** creates a JSON DAG. This is our roadmap. No token is wasted on aimless wandering.
3.  **🚀 Phase 3: Parallel Execution**: The **Orchestrator** identifies independent tasks and runs them concurrently.
4.  **🛡️ Phase 4: Sync & Verify**: The **Reviewer** acts as the gatekeeper. It checks syntax, logic, and *cross-file consistency*.
5.  **💰 Phase 5: Cost-Effective Completion**: We achieve "Senior Developer" results at "Junior Intern" prices.

---

---

---

## ⚡ Fast-Paced Development

This project is evolving **extremely fast**. We iterate rapidly to bring relentless execution to your workflow.
Updates are frequent. Keep your version fresh.
