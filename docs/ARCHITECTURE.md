# Architecture

> **6-Agent Collaborative System**

---

## Overview

OpenCode Orchestrator transforms LLMs into reliable engineering teams through:
- **Atomic Decomposition** — Tasks broken into verifiable micro-units  
- **PDCA Loop** — Plan → Do → Check → Act cycle
- **Parallel DAG** — Concurrent task execution
- **Quality Gates** — Reviewer validates all outputs

---

## The 6 Agents

| Agent | Role | Permissions |
|-------|------|-------------|
| **Orchestrator** | Team leader, coordinates mission | Read-only |
| **Planner** | Decomposes work into DAG | Read-only |
| **Coder** | Implements atomic tasks | Write + Bash |
| **Reviewer** | Quality gate, catches errors | Bash (tests) |
| **Fixer** | Targeted error resolution | Write + Bash |
| **Searcher** | Finds context before coding | Read-only |

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

---

## Workflow

1. **`/task "mission"`** → Orchestrator starts
2. **Searcher** reads docs, finds patterns
3. **Planner** creates atomic task DAG
4. **Coder** executes tasks (parallel if independent)
5. **Reviewer** validates each output
6. **Fixer** handles errors (if any)
7. **Orchestrator** runs build verification
8. ✅ Complete when build passes

---

## State Management

- **Mission File**: `.opencode_mission.md` — persistent state
- **Context Shards**: `temp_context_*.md` — large context handling
- **Cleanup**: Shards deleted after mission complete

---

## Relentless Loop

The system automatically continues until mission complete:

1. **Auto-Activation**: Selecting Orchestrator agent activates mission mode
2. **Completion Detection**:
   - `✅ MISSION COMPLETE`
   - `All tasks completed`
   - TaskGraph `isCompleted()` returns true
3. **Auto-Continue**: If not complete, system injects "continue" message
4. **Safety Limit**: Maximum 1000 iterations (configurable)

---

## Core Principles

- **Minimal Modification** — Smallest change to achieve goal
- **Existing Stack Preservation** — No language/framework conversion
- **Quality First** — Reviewer always verifies before merge
- **Self-Healing** — Automatic retry with Fixer on errors
- **Relentless Execution** — Never stops until mission complete

