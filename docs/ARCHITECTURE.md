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

| Agent         | Emoji | Responsibility                                                                 |
| ------------- | ----- | ------------------------------------------------------------------------------ |
| **Commander** | 🎯    | The "Brain" - Handles the relentless loop, delegation, and final verification. |
| **Architect** | 🏗️    | The "Planner" - Breaks complex goals into atomic, parallelizable tasks.        |
| **Builder**   | 🔨    | The "Hand" - Writes logic and UI code matching project patterns.               |
| **Inspector** | 🔍    | The "Eye" - Audits every change and auto-fixes any syntax or logic errors.     |
| **Recorder**  | 💾    | The "Memory" - Saves environmental data and progress to disk.                  |

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

| Failures | Action                                                                       |
| -------- | ---------------------------------------------------------------------------- |
| 1-2      | Adjust prompt and retry task.                                                |
| 3+       | **Emergency Stop**. Revert changes and consult Architect for a new strategy. |

---

## Persistent Storage (.opencode/)

Orchestrator maintains a local "Brain" directory to survive session restarts:

- `environment.md`: Project infrastructure snapshot.
- `mission.md`: The current high-level goal.
- `progress.md`: Completed vs Remaining tasks.
- `context.md`: Agent-readable state snapshot.

---

## Parallel Agent Execution

Orchestrator supports **parallel agent execution** through session-based spawning with queue-based concurrency control.

### Parallel Agent Tools

| Tool              | Description                                       |
| ----------------- | ------------------------------------------------- |
| `delegate_task`   | Delegate work to an agent (sync or async)         |
| `get_task_result` | Retrieve the result from a completed task         |
| `list_tasks`      | View all parallel tasks and their status          |
| `cancel_task`     | Stop a running task and free the concurrency slot |

### Safety Features

- **Queue-based concurrency**: Max 3 agents per type (extras automatically queue)
- **Batched notifications**: System notifies when ALL tasks complete
- **Auto-timeout**: 30 minute maximum runtime
- **Auto-cleanup**: Removed from memory 5 minutes after completion
- **Output validation**: Verifies session has actual content before completion

### Architecture

```
┌────────────────────────────────────────────────────────┐
│  ParallelAgentManager (TypeScript)                     │
│  ├── ConcurrencyController (queue-based rate limiting) │
│  ├── Task tracking per parent session                  │
│  ├── Batched notification system                       │
│  └── Delayed cleanup (5 min after completion)          │
└────────────────────────────────────────────────────────┘
```

---

## Background Command Execution

For long-running shell commands (builds, tests, linting), use the background task tools.

### Background Task Tools

| Tool               | Description                                                |
| ------------------ | ---------------------------------------------------------- |
| `run_background`   | Start a command in background, returns task ID immediately |
| `check_background` | Check status and output of a background task               |
| `list_background`  | List all background tasks and their status                 |
| `kill_background`  | Terminate a running background task                        |

### Example Flow

```
1. delegate_task({ agent: "builder", prompt: "Features", background: true })
   delegate_task({ agent: "inspector", prompt: "Review", background: true })
   → Both agents start in parallel sessions (Non-blocking)

2. run_background({ command: "npm run build" })
   → Command starts, returns immediately

3. (Agent continues other work while tasks run)

4. [System notification: "All Parallel Tasks Complete"]

5. get_task_result({ taskId: "task_xxx" })
   check_background({ taskId: "job_xxx" })
   → Retrieve results
```

---

## Summary of Benefits

- **Autonomous**: Once started, it requires zero user interaction.
- **Reliable**: Environment-specific verification ensures the code actually runs.
- **Consistent**: Mandatory pattern scanning prevents "code rotting."
- **Parallel**: Queue-based concurrency enables safe parallel agent execution.
- **Non-blocking**: Background tasks allow concurrent work during long operations.
