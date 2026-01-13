# OpenCode Orchestrator

> **Multi-Agent Plugin for [OpenCode](https://opencode.ai)** — Transform any model into a reliable coding team

<div align="center">

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/opencode-orchestrator.svg)](https://www.npmjs.com/package/opencode-orchestrator)
[![OpenCode Plugin](https://img.shields.io/badge/OpenCode-Plugin-purple.svg)](https://opencode.ai)

**Rust-Powered** • **Memory Safe** • **Blazing Fast**

</div>

---

## 🚀 Why Orchestrator?

**Stop paying for expensive models. Start working smarter.**

| Traditional | Orchestrator |
|-------------|--------------|
| One big prompt → Hope it works | Atomic tasks → Verified every step |
| Expensive model required | Any model works |
| Errors compound silently | Self-correcting loop |
| Unpredictable results | Consistent quality |

### ⚡ What Makes It Different

- **🦀 Rust Core** — Memory-safe, zero-overhead performance. No garbage collection pause.
- **🧠 Micro-Task Architecture** — Break complex work into atomic units. Even lightweight models excel with focused tasks.
- **🔄 Self-Correcting Loop** — Every change verified. Errors caught and fixed automatically.
- **👥 6-Agent Team** — Specialized roles collaborate like a real dev team.

---

## 💡 Philosophy

**The model doesn't matter. The workflow does.**

A focused, verified approach beats raw intelligence:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   Complex Task                                                  │
│        │                                                        │
│        ▼                                                        │
│   ┌─────────┐                                                   │
│   │ PLANNER │ → Break into atomic tasks                         │
│   └────┬────┘                                                   │
│        │                                                        │
│        ▼                                                        │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  For each micro-task:                                   │   │
│   │                                                         │   │
│   │   [Search] → [Code] → [Review] → [Fix if needed]       │   │
│   │        ↑                              │                 │   │
│   │        └──────────────────────────────┘                 │   │
│   │              Self-correcting loop                       │   │
│   └─────────────────────────────────────────────────────────┘   │
│        │                                                        │
│        ▼                                                        │
│   ✅ Verified, Working Code                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Result**: Cheaper models outperform expensive ones through disciplined execution.

---

## 📦 Install

```bash
npm install opencode-orchestrator
# or
bun add opencode-orchestrator
```

Auto-registers with OpenCode. Just restart.

---

## 🎮 Usage

```
/auto implement user authentication with JWT
```

The agents take over:
1. **Planner** breaks it into atomic tasks
2. **Searcher** finds existing patterns
3. **Coder** implements one task at a time
4. **Reviewer** verifies every change
5. **Fixer** corrects any errors
6. Loop until complete ✅

---

## 🤖 The Team

| Agent | Role | Superpower |
|-------|------|------------|
| **Planner** | Task Decomposition | Turns "build auth" into 10 atomic steps |
| **Searcher** | Context Provider | Finds patterns before coding |
| **Coder** | Implementation | One task, complete code |
| **Reviewer** | Quality Gate | Catches ALL errors |
| **Fixer** | Error Resolution | Targeted fixes only |
| **Orchestrator** | Team Leader | Coordinates, decides, adapts |

---

## 📋 Commands

| Command | What It Does |
|---------|--------------|
| `/auto "task"` | Full autonomous execution |
| `/plan "task"` | Just decompose into tasks |
| `/review` | Quality check current code |
| `/fix "error"` | Fix specific issue |
| `/search "pattern"` | Find codebase patterns |

---

## 🛡️ Safety & Reliability

| Feature | Description |
|---------|-------------|
| **Circuit Breaker** | Same error 3x → Stop and ask user |
| **Iteration Cap** | Max 100 steps prevents runaway |
| **Atomic Tasks** | Small scope = fewer errors |
| **Mandatory Review** | Every code change verified |

---

## 🦀 Why Rust?

The core search and analysis tools are written in Rust:

- **Memory Safe** — No buffer overflows, no null pointer crashes
- **Zero-Cost Abstractions** — Fast as C, safe as Haskell
- **Concurrent by Design** — Safe parallelism without data races
- **Instant Startup** — No JIT warmup, no GC pauses

---

## 📚 Documentation

- **[Architecture](docs/ARCHITECTURE.md)** — Agent roles, workflow, error recovery
- **[Publishing](docs/PUBLISHING.md)** — How to release new versions
- **[Configuration](examples/orchestrator.jsonc)** — Customize agent settings

---

## 🌟 Open Source

100% open source. MIT license. No telemetry. No backdoors.

Inspect every line: [github.com/agnusdei1207/opencode-orchestrator](https://github.com/agnusdei1207/opencode-orchestrator)

---

## 📄 License

[MIT](LICENSE) — Use freely, modify freely, contribute freely.

---

<div align="center">

**Built for [OpenCode](https://opencode.ai)**

*Transform any model into a reliable coding team*

</div>
