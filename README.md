# OpenCode Orchestrator

> Multi-Agent Plugin for [OpenCode](https://opencode.ai)

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/opencode-orchestrator.svg)](https://www.npmjs.com/package/opencode-orchestrator)

---

## What is this?

A 6-agent collaborative system that turns any LLM into a reliable coding team.

**Core idea**: Break complex tasks into atomic units, verify each step, fix errors automatically.

---

## Features

- **Rust Core** — Fast, memory-safe search and analysis tools
- **Micro-Task Architecture** — Atomic task decomposition for reliability
- **Self-Correcting Loop** — Every change reviewed, errors auto-fixed
- **6-Agent Team** — Specialized roles: Planner, Coder, Reviewer, Fixer, Searcher, Orchestrator
- **Circuit Breaker** — Stops after 3 same errors, prevents infinite loops
- **Full Autonomy** — `/auto` command handles everything

---

## Install

```bash
npm install opencode-orchestrator
```

Auto-registers with OpenCode. Just restart.

---

## Usage

```
/auto implement user authentication with JWT
```

What happens:
1. Planner → atomic tasks
2. For each task: Search → Code → Review → Fix (if needed)
3. Loop until all pass ✅

---

## Commands

| Command | Description |
|---------|-------------|
| `/auto` | Autonomous execution |
| `/plan` | Decompose into tasks |
| `/review` | Quality check |
| `/fix` | Fix specific error |
| `/search` | Find patterns |

---

## Agents

| Agent | Role |
|-------|------|
| **Orchestrator** | Team leader, coordinates all |
| **Planner** | Breaks work into atomic tasks |
| **Coder** | Implements one task at a time |
| **Reviewer** | Quality gate, catches all errors |
| **Fixer** | Targeted error resolution |
| **Searcher** | Finds context before coding |

---

## Configuration

See [examples/orchestrator.jsonc](examples/orchestrator.jsonc) for options.

---

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — Detailed workflow
- [Publishing](docs/PUBLISHING.md) — Release process

---

## Open Source

MIT License. No telemetry. No backdoors. 

[View source](https://github.com/agnusdei1207/opencode-orchestrator)

---

## Author's Note

> My goal is to prove that **affordable subscription models like GLM-4.7** can produce results as good as expensive APIs — if you structure the work right.
>
> This plugin is my answer: break tasks down, verify every step, fix errors automatically. The model doesn't need to be smart. The process needs to be disciplined.
>
> — [@agnusdei1207](https://github.com/agnusdei1207)

---

## License

[MIT](LICENSE)
