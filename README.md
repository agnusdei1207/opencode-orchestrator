#OpenCode Orchestrator Plugin

> **Multi-Agent Plugin for [OpenCode](https://opencode.ai)**

<div align="center">

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/@agnusdei1207/opencode-orchestrator.svg)](https://www.npmjs.com/package/@agnusdei1207/opencode-orchestrator)
[![npm downloads](https://img.shields.io/npm/dt/@agnusdei1207/opencode-orchestrator.svg)](https://www.npmjs.com/package/@agnusdei1207/opencode-orchestrator)
[![OpenCode Plugin](https://img.shields.io/badge/OpenCode-Plugin-purple.svg)](https://opencode.ai)

[English](README.md) | [한국어](docs/README/README.ko.md) | [简体中文](docs/README/README.zh.md) | [日本語](docs/README/README.ja.md) | [Español](docs/README/README.es.md) | [Français](docs/README/README.fr.md) | [Deutsch](docs/README/README.de.md)
[Русский](docs/README/README.ru.md) | [Português](docs/README/README.pt.md)

</div>

---

## What is this?

A 6-agent collaborative system that maximizes **Agent Orchestration** to extract **Ultimate Decision Quality** from **affordable, lower-performance models**.

**Core idea**: By strategically organizing roles, breaking work into micro-tasks, and enforcing strict verification rules, we achieve "Expensive Model" results with "Budget Model" costs.

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

> My goal is to prove that **affordable models** can produce results as good as expensive APIs — when you structure the work right.
>
> Break tasks down, verify every step, fix errors automatically. The model doesn't need to be smart. The process needs to be disciplined.
>
> — [@agnusdei1207](https://github.com/agnusdei1207)

---

## License

MIT License. NO WARRANTY.

[MIT](LICENSE)

---

## 🏛️ The Architecture: Distributed Cognitive Orchestration (DCO)

We have moved beyond the paradigm of a "single smart chatbot". **OpenCode Orchestrator** is a **Deterministic Engineering Layer** built atop the stochastic nature of Large Language Models.

We treat agents not as personalities, but as **Semantic Compute Units**. By applying rigorous Computer Science principles, we achieve a level of reliability that no single model—regardless of parameter count—can match.

### 🧬 The "Grand Fusion" of Computer Science
We explicitly fused three massive domains into one seamless workflow:

1.  **Distributed Systems Theory (The "Actor Model")**:
    *   **Independent Agents**: The Planner, Coder, and Searcher operate as independent **Actors** with isolated state.
    *   **Byzantine Fault Tolerance**: The **Reviewer** acts as a consensus node, rigorously validating code against project standards to prevent "hallucinated" regressions.

2.  **Algorithmic Efficiency (MapReduce & Divide & Conquer)**:
    *   **Map (Planner)**: Complex missions are recursively decomposed ($O(log n)$ complexity) into atomic 20-line tasks.
    *   **Reduce (Orchestrator)**: Parallel execution streams are aggregated, synchronized, and merged into the final consistent state.

3.  **Kernel Operating Principles (Scheduling & Memory)**:
    *   **Context Sharding (Virtual Memory)**: We treat Context Window as RAM. Massive docs are sharded into `temp_context` files (Page Swapping) and loaded only on "Page Faults" (Information Gaps).
    *   **DAG Scheduling**: Tasks form a non-blocking Directed Acyclic Graph, optimizing for wall-clock time over thread concurrency.

### 🚀 The Command: `/flow`

The interface to this power is a single, intuitive command:

```bash
/flow "Refactor the authentication middleware and implement JWT rotation"
```

This ensures **"Operational Flow"**. It signifies a stream of intelligent actions flowing from intent to realization, managed by a rigid, self-correcting graph.

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
