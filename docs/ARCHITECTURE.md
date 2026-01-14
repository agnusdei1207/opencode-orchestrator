# OpenCode Orchestrator - Architecture & Design

## Overview

OpenCode Orchestrator is an autonomous multi-agent system designed for the OpenCode platform. It solves the "LLM slop" problem by wrapping raw AI intelligence in a **structured engineering lifecycle**.

---

## Core Philosophy: Context First

Most agents fail because they assume too much. Orchestrator operates on a **Context-First** principle:

1.  **Infrastructure Awareness**: Is it a Docker container? A native OS? A volume mount?
2.  **Domain Mapping**: Is this a Web SSR app or a CLI tool?
3.  **Pattern Matching**: Don't invent code; match existing codebase conventions.

---

## 5-Agent Structured Architecture

| Agent | Emoji | Responsibility |
|-------|-------|----------------|
| **Commander** | 🎯 | The "Brain" - Handles the relentless loop, delegation, and final verification. |
| **Architect** | 🏗️ | The "Planner" - Breaks complex goals into atomic, parallelizable tasks. |
| **Builder** | 🔨 | The "Hand" - Writes logic and UI code matching project patterns. |
| **Inspector** | 🔍 | The "Eye" - Audits every change and auto-fixes any syntax or logic errors. |
| **Recorder** | 💾 | The "Memory" - Saves environmental data and progress to disk. |

---

## The Progressive Lifecycle (Scalable Intelligence)

Orchestrator uses **Progressive Disclosure** to balance speed and depth.

### PHASE 0: Triage & Classification
- **Fast Track (L1)**: Simple changes. Skip JSON planning and full scans.
- **Deep Track (L3)**: Complex refactoring. Trigger full cognitive loop.

### PHASE 1: Mandatory Environment Scan (Conditional)
- **Deep Track Only**: Commander surveys Infra (Docker/OS), Domain, and Stack.
- Saves `environment.md` via Recorder.

### PHASE 2: Task Decomposition
Architect creates a DAG, scaling complexity based on the track:
- **Fast**: Direct execution list.
- **Deep**: Full parallel DAG with dependencies.

### PHASE 4: Implementation (Builder & Inspector)
- **Builder**: Writes code using `@apply` for Tailwind, proper types for TS, etc.
- **Inspector**: Audits the code. If it fails, Inspector switches to **FIX mode** and repairs the code directly.

### PHASE 5: Flexible Verification
Final success is proven based on the environment:
- **Node**: `npm run build`
- **Rust**: `cargo build`
- **Docker**: Validation of configs and syntax.
- **Manual**: Inspector logic summary if no automated tests exist.

---

## Efficient Communication Protocol

To optimize for performance and token usage, Orchestrator uses a **Text-based Protocol** instead of heavy JSON/XML where possible.

**Delegation Format:**
```text
AGENT: builder
TASK: Add login endpoint
ENVIRONMENT: Docker + Node.js (JWT Auth)
PATTERN: Match /src/routes/*.ts
VERIFY: lsp_diagnostics clean + build pass
```

---

## Failure Recovery (3-Strike Rule)

| Failures | Action |
|----------|--------|
| 1-2 | Adjust prompt and retry task. |
| 3+ | **Emergency Stop**. Revert changes and consult Architect for a new strategy. |

---

## Persistent Storage (.opencode/)

Orchestrator maintains a local "Brain" directory to survive session restarts:
- `environment.md`: Project infrastructure snapshot.
- `mission.md`: The current high-level goal.
- `progress.md`: Completed vs Remaining tasks.
- `context.md`: Agent-readable state snapshot.

---

## Summary of Benefits

- **Autonomous**: Once started, it requires zero user interaction.
- **Reliable**: Environment-specific verification ensures the code actually runs.
- **Consistent**: Mandatory pattern scanning prevents "code rotting."
- **Efficient**: Parallel task groups maximize LLM throughput.
