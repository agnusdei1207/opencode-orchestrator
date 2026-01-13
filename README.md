#OpenCode Orchestrator Plugin

> **Multi-Agent Plugin for [OpenCode](https://opencode.ai)**

<div align="center">
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/opencode-orchestrator.svg)](https://www.npmjs.com/package/opencode-orchestrator)
[![npm downloads](https://img.shields.io/npm/dt/opencode-orchestrator.svg)](https://www.npmjs.com/package/opencode-orchestrator)
[![OpenCode Plugin](https://img.shields.io/badge/OpenCode-Plugin-purple.svg)](https://opencode.ai)
</div>

---

## What is this?

A 6-agent collaborative system that turns any LLM into a reliable coding team.

**Core idea**: Break complex tasks into atomic units, verify each step, fix errors automatically.

---

## Why Orchestrator?

| Traditional | With Orchestrator |
|-------------|-------------------|
| One big prompt → Hope it works | Atomic tasks → Verified every step |
| Expensive model required | Any model works |
| Errors compound silently | Self-correcting loop |
| Unpredictable results | **Relentless execution until success** |

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

## ⚡ Fast-Paced Development

This project is evolving **extremely fast**. We iterate rapidly to bring relentless execution to your workflow.
Updates are frequent. Keep your version fresh.
