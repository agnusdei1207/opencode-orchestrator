# OpenCode Orchestrator Plugin

> **Multi-Agent Plugin for [OpenCode](https://opencode.ai)**

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/opencode-orchestrator.svg)](https://www.npmjs.com/package/opencode-orchestrator)
[![npm downloads](https://img.shields.io/npm/dt/opencode-orchestrator.svg)](https://www.npmjs.com/package/opencode-orchestrator)
[![OpenCode Plugin](https://img.shields.io/badge/OpenCode-Plugin-purple.svg)](https://opencode.ai)

**OpenCode Orchestrator** is a collaborative framework that enables **low-benchmark models to deliver senior-level engineering results**. 

By maximizing the **method of agent collaboration**, we overcome the inherent limitations of individual AI models. We don't just "chat" with AI; we use a structured engineering layer to ensure complex missions are executed with 100% reliability and relentlessly pushed to completion, regardless of the model's price point.

**Core Philosophy: Excellence through Collaboration**

We believe that **a perfect collaboration method is superior to individual intelligence**.

*   **Systems Engineering Fusion**: We integrate Operating System principles (Scheduling), Distributed Systems (Actor Model), and Algorithm Theory (Divide & Conquer) to transform unpredictable LLMs into a **controlled computing resource**.
*   **Relentless PDCA Loop**: Every change follows a strict **Plan-Do-Check-Act** cycle. This systematic approach ensures that high-level professional tasks are completed without the quality decay or hallucinations typical of raw LLM outputs.
*   **Architecture over Benchmarks**: By decomposing missions into atomic, verifiable tasks, we extract **high-fidelity outcomes** from cost-effective models, proving that superior architecture can outperform raw scale.

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
If the command `/task` does not appear:
1. Uninstall: `npm uninstall -g opencode-orchestrator` (or `bun remove -g`)
2. Clear config: `rm -rf ~/.config/opencode` (Warning: resets all plugins)
3. Reinstall: `npm install -g opencode-orchestrator`


---

**The only command you need:**

```bash
/task "Implement user authentication with JWT"
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

## ⚡ Fast-Paced Development

This project is evolving **extremely fast**. We iterate rapidly to bring relentless execution to your workflow.
Updates are frequent. Keep your version fresh.
