<div align="center">
  <img src="assets/logo.png" alt="Logo" width="200" />
</div>

# OpenCode Orchestrator

> **Multi-Agent Plugin for [OpenCode](https://opencode.ai)**

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/opencode-orchestrator.svg)](https://www.npmjs.com/package/opencode-orchestrator)

---

## What is this?

A **5-agent structured architecture** that makes weak LLMs perform reliably.

**Problem**: Models like GLM-4.7 struggle with complex engineering tasks.

**Solution**: XML-structured prompts + explicit reasoning patterns + evidence-based completion.

### Key Features
- **Structured Prompts** — XML tags provide clear boundaries for weak models
- **Explicit Reasoning** — THINK → ACT → OBSERVE → ADJUST pattern
- **Auto-Fix** — Inspector audits AND repairs automatically
- **Persistent Memory** — Context saved to disk, never lost
- **Parallel Execution** — Independent tasks run concurrently
- **Relentless Loop** — Runs until mission complete (no user input needed)

---

## Installation

```bash
npm install -g opencode-orchestrator
```

Restart OpenCode after installation.

---

## Usage

### Just Select Commander Agent
Press `tab` → Select **Commander** → Type your request!

```
"Implement user authentication with JWT"
```

That's it. Commander automatically:
1. Enters mission mode
2. Plans tasks in parallel
3. Executes until complete
4. Stops when done with evidence

### Or Use /task Command
```bash
/task "Implement user authentication with JWT"
```

Both work identically - Commander agent OR /task command.

---

## How It Works

```
     Select Commander or /task
           │
           ▼
    ┌─────────────┐
    │  COMMANDER  │  ← THINK → ACT → OBSERVE → ADJUST
    └──────┬──────┘
           │
    ┌──────┴──────┐
    ▼             ▼
 ARCHITECT    MEMORY (load context)
    │
    ▼
 ┌──────────────────┐
 │  PARALLEL DAG    │
 │  Group 1: [T1, T2, T3] ← run together
 │  Group 2: [T4] ← wait for group 1
 └──────────────────┘
           │
    ┌──────┴──────┐
    ▼             ▼
 BUILDER       BUILDER  (parallel)
    │             │
    └──────┬──────┘
           ▼
    ┌─────────────┐
    │  INSPECTOR  │  ← AUDIT → [FAIL? → FIX] → PASS
    └──────┬──────┘
           ▼
    ┌─────────────┐
    │   MEMORY    │  ← Save progress
    └──────┬──────┘
           ▼
        ✅ MISSION COMPLETE
```

---

## Agents (5-Agent Architecture)

| Agent | Role | What It Does |
| :--- | :--- | :--- |
| **Commander** | Orchestrator | Controls mission, delegates work, verifies completion |
| **Architect** | Planner | Decomposes complex tasks into parallel DAGs |
| **Builder** | Developer | Implements code (logic + UI combined) |
| **Inspector** | Quality + Fix | Audits code AND auto-fixes problems |
| **Memory** | Context | Saves/loads progress across sessions |

### Why 5 Agents?
- **Builder** = Coder + Visualist (full-stack in one agent)
- **Inspector** = Reviewer + Fixer (auto-fixes on audit failure)
- **Fewer agents = fewer handoffs = better for weak models**

---

## Optimized for Weak Models

| Technique | Purpose |
|-----------|---------|
| XML tags | Clear semantic boundaries |
| THINK-ACT-OBSERVE-ADJUST | Explicit step-by-step reasoning |
| Few-shot examples | Correct output format learning |
| Tables/JSON output | Structured over prose |
| Evidence required | Concrete verification criteria |

---

## Uninstall

```bash
npm uninstall -g opencode-orchestrator
```

The plugin automatically removes itself from OpenCode config.

---

## Troubleshooting

If Commander doesn't appear after install:
```bash
npm uninstall -g opencode-orchestrator
npm install -g opencode-orchestrator
# Restart OpenCode
```

---

## Docs

- [Architecture & Design](docs/ARCHITECTURE.md) — System design, agents, and why it works
- [Plugin Troubleshooting](docs/PLUGIN_TROUBLESHOOTING.md) — Setup issues

---

## License

MIT License. [LICENSE](LICENSE)

---

**Updates are frequent. Keep your version fresh.**
