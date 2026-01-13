# OpenCode Orchestrator

> **Multi-Agent Plugin for [OpenCode](https://opencode.ai)** — Make cheap models outperform expensive ones

<div align="center">

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![OpenCode Plugin](https://img.shields.io/badge/OpenCode-Plugin-purple.svg)](https://opencode.ai)

</div>

---

## 💡 Philosophy

**The model doesn't matter. The workflow does.**

Any model — even lightweight ones — can produce reliable, production-quality code when:

1. **Tasks are atomic** — one function, one fix, one file at a time
2. **Every change is verified** — quality gate catches errors immediately
3. **Errors trigger fixes** — self-correcting loop until it works

This plugin implements a **6-agent team** that turns any model into a disciplined development process.

---

## 🚀 Quick Start

### Install

```bash
npm install opencode-orchestrator
# or
bun add opencode-orchestrator
```

Plugin auto-registers. Just restart OpenCode.

### Use

```
/auto implement user authentication with JWT
```

That's it. The agents handle the rest.

---

## 🤖 How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    SELF-CORRECTING LOOP                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   User Request                                              │
│        │                                                    │
│        ▼                                                    │
│   ┌─────────┐     ┌─────────────────────────────────────┐   │
│   │ PLANNER │────▶│ Atomic Tasks: [T1] [T2] [T3] ...   │   │
│   └─────────┘     └─────────────────────────────────────┘   │
│                              │                              │
│                              ▼                              │
│   ┌──────────────────────────────────────────────────────┐  │
│   │  FOR EACH TASK:                                      │  │
│   │                                                      │  │
│   │    SEARCHER ─▶ CODER ─▶ REVIEWER ─┬─▶ ✅ NEXT       │  │
│   │                            │      │                  │  │
│   │                         ❌ FAIL   │                  │  │
│   │                            │      │                  │  │
│   │                            ▼      │                  │  │
│   │                         FIXER ────┘                  │  │
│   │                        (retry ≤3)                    │  │
│   │                                                      │  │
│   └──────────────────────────────────────────────────────┘  │
│                              │                              │
│                              ▼                              │
│                        ✅ COMPLETE                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Agents

| Agent | Job |
|-------|-----|
| **Planner** | Decomposes complex tasks into atomic units |
| **Searcher** | Finds patterns and context in codebase |
| **Coder** | Implements one atomic task at a time |
| **Reviewer** | Quality gate — catches all errors |
| **Fixer** | Applies targeted fixes from reviewer feedback |

---

## 📋 Commands

| Command | Description |
|---------|-------------|
| `/auto "task"` | Autonomous execution until complete |
| `/plan "task"` | Decompose into atomic tasks |
| `/review "code"` | Quality check |
| `/fix "errors"` | Apply fixes |
| `/search "pattern"` | Find context |

---

## 🛡️ Error Prevention

| Feature | What It Does |
|---------|--------------|
| **Self-Correcting Loop** | Errors trigger fix → verify cycle |
| **Retry Limit** | Same error 3x = stop and ask user |
| **Iteration Cap** | Max 100 iterations prevents runaway |
| **Atomic Tasks** | Small scope = fewer errors |

---

## ⚡ Why This Works

### Traditional Approach
```
[Big Model] ──────────────────────────▶ [Hope it works?]
```

### Orchestrator Approach
```
[Any Model] ──▶ [Small Task] ──▶ [Verify] ──▶ [Fix if needed] ──▶ ✅
```

**Results:**
- 🔧 **Fewer errors**: Each change is verified
- 💰 **Lower cost**: Cheap models work fine
- 🔄 **Self-healing**: Errors get fixed automatically
- 📊 **Predictable**: Clear progress tracking

---

## 📚 Documentation

- **[Architecture Guide](docs/ARCHITECTURE.md)** — Detailed workflow documentation
- **[Configuration](examples/orchestrator.jsonc)** — Customize agent settings

---

## 📄 License

[MIT](LICENSE) — Use freely, modify freely, no strings attached.

---

<div align="center">

**Built for [OpenCode](https://opencode.ai)** • Make cheap models work like expensive ones

</div>
