<div align="center">
  <img src="assets/logo.png" alt="Logo" width="200" />
</div>

# OpenCode Orchestrator

> **Multi-Agent Plugin for [OpenCode](https://opencode.ai)**

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/opencode-orchestrator.svg)](https://www.npmjs.com/package/opencode-orchestrator)

---

## What is this?

A 6-agent collaborative system that turns **affordable LLMs into reliable engineering teams**.

- **Relentless Loop** — Auto-continues until mission complete
- **Atomic Decomposition** — Tasks broken into verifiable micro-units
- **PDCA Loop** — Plan → Do → Check → Act (self-correcting)
- **Parallel DAG** — Independent tasks run concurrently  
- **Quality Gate** — Reviewer catches all errors before merge

---

## Installation

```bash
npm install -g opencode-orchestrator
```

Restart OpenCode after installation.

---

## Usage

### Option 1: Select Orchestrator Agent
Press `tab` → Select **Orchestrator** → Just type your request!

```
"Implement user authentication with JWT"
```

### Option 2: Use /task Command
```bash
/task "Implement user authentication with JWT"
```

Both methods activate **Relentless Loop** — the agent continues automatically until mission complete.

### How It Works:
1. **Plan** — Decompose into atomic tasks
2. **Search** — Find patterns and context
3. **Code** — Implement with precision
4. **Review** — Verify via quality gate
5. **Fix** — Self-heal if errors occur
6. **Loop** — Repeat until ✅ MISSION COMPLETE

---

## Agents

| Agent | Role |
|-------|------|
| Orchestrator | Team leader — coordinates the mission |
| Planner | Decomposes work into atomic tasks |
| Coder | Implements one task at a time |
| Reviewer | Quality gate — catches all errors |
| Fixer | Targeted error resolution |
| Searcher | Finds context before coding |

---

## How It Works

```
     /task "mission"
           │
           ▼
    ┌─────────────┐
    │   PLANNER   │
    └──────┬──────┘
           │
    ┌──────┴──────┐
    ▼             ▼
 [Task A]     [Task B]  (parallel)
    │             │
    └──────┬──────┘
           ▼
    ┌─────────────┐
    │  REVIEWER   │
    └──────┬──────┘
           ▼
        ✅ DONE
```

---

## PDCA Control Loop

```
┌─────────────────────────────────────────────────────┐
│                    PDCA LOOP                        │
│                                                     │
│   PLAN ──→ DO ──→ CHECK ──→ ACT                    │
│     │       │        │        │                     │
│   Planner  Coder   Reviewer  Orchestrator          │
│     ↓       ↓        ↓        ↓                     │
│   DAG     Code    Pass/Fail  Merge/Pivot           │
│                      │                              │
│              ┌───────┴───────┐                     │
│              ↓               ↓                     │
│           ✅ Pass         ❌ Fail → Fixer          │
└─────────────────────────────────────────────────────┘
```

## Troubleshooting

If `/task` doesn't appear:
```bash
npm uninstall -g opencode-orchestrator
npm install -g opencode-orchestrator
```

---

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Plugin Troubleshooting](docs/PLUGIN_TROUBLESHOOTING.md)

---

## License

MIT License. [LICENSE](LICENSE)

---

**Fast-Paced Development** — Updates are frequent. Keep your version fresh.
