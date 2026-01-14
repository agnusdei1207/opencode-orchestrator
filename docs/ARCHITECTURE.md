# OpenCode Orchestrator - Architecture & Design

## Overview

OpenCode Orchestrator is a multi-agent plugin for OpenCode that enables autonomous engineering execution. It is designed to make **weak LLM models (like GLM-4.7) perform reliably** through structured prompting and explicit reasoning patterns.

---

## Core Problem

Weak LLM models struggle with:
- Vague or implicit instructions
- Complex multi-step reasoning
- Maintaining context across tasks
- Knowing when tasks are actually complete

---

## Solution: Structured Architecture

OpenCode Orchestrator addresses these issues through:

| Technique | How It Helps |
|-----------|--------------|
| XML-Structured Prompts | Clear boundaries with explicit tags |
| Explicit Reasoning Pattern | THINK → ACT → OBSERVE → ADJUST |
| Few-Shot Examples | Every agent includes example inputs/outputs |
| Evidence-Based Completion | No task is "done" without proof |
| Persistent Memory | Context saved to disk, never lost |

---

## Agent Architecture (5 Agents)

| Agent | Role | Responsibility |
|-------|------|----------------|
| **Commander** | Orchestrator | Controls the mission, delegates work, verifies completion |
| **Architect** | Planner | Decomposes complex tasks into parallel DAGs |
| **Builder** | Developer | Implements code (both logic and UI) |
| **Inspector** | Quality + Fix | Audits code AND auto-fixes problems |
| **Memory** | Context | Saves/loads progress across sessions |

### Why 5 Agents (Not More)?

Each agent combination eliminates a handoff:

| Combined Agent | Replaces | Benefit |
|----------------|----------|---------|
| Builder | Coder + Visualist | Full-stack without handoff |
| Inspector | Reviewer + Fixer | Auto-fixes on audit failure |
| Architect | Planner + Strategist | Single decision maker |

**Fewer agents = fewer handoffs = less context loss = better for weak models.**

---

## Reasoning Pattern

All agents follow this explicit pattern:

```xml
<think>
Current State: [What is done]
Next Goal: [What to do]
Best Action: [Decision]
</think>

<act>
[Execute the action]
</act>

<observe>
Result: [What happened]
Success: [YES/NO with evidence]
</observe>

<adjust>
[Only if failed - what to change]
</adjust>
```

This pattern forces even weak models to reason step-by-step.

---

## Delegation Format

When Commander delegates to an agent, it uses this exact format:

```xml
<delegate>
<agent>[agent name]</agent>
<objective>[ONE atomic goal]</objective>
<success>[How to verify]</success>
<do>[Requirements - be exhaustive]</do>
<dont>[Restrictions - prevent mistakes]</dont>
<context>[Files, patterns, state]</context>
</delegate>
```

The 5-section format is optimized for clarity with weak models.

---

## Task Decomposition (Architect)

Architect outputs tasks in JSON with parallel execution groups:

```json
{
  "mission": "Add user auth",
  "tasks": [
    {"id": "T1", "agent": "builder", "parallel_group": 1},
    {"id": "T2", "agent": "builder", "parallel_group": 1},
    {"id": "T3", "agent": "inspector", "parallel_group": 2, "dependencies": ["T1", "T2"]}
  ]
}
```

Tasks in the same `parallel_group` run concurrently.

---

## Quality Verification (Inspector)

Inspector runs a 5-point audit:

1. **Syntax Check** - lsp_diagnostics must show 0 errors
2. **Pattern Check** - Code follows existing codebase patterns
3. **Type Check** - All types explicit, no `any`
4. **Security Check** - No hardcoded secrets
5. **Logic Check** - Code fulfills the objective

If any check fails, Inspector **automatically switches to FIX mode**.

---

## Persistent Memory

Memory agent saves context to disk:

```
.opencode/
  {date}/
    mission.md    - What the user asked for
    progress.md   - Task completion log
    context.md    - Snapshot for agents
```

This ensures context is never lost between sessions.

---

## Failure Recovery

| Failures | Action |
|----------|--------|
| 1-2 | Retry with adjusted approach |
| 3-4 | Architect provides new strategy |
| 5+ | Stop and ask user |

---

## Execution Flow

```
User Request (Commander agent or /task)
    ↓
Commander: THINK about next action
    ↓
[Complex Task?] → Architect: Generate DAG
    ↓
Commander: Delegate to Builder (parallel tasks)
    ↓
Builder: THINK → ACT → OBSERVE → Report
    ↓
Commander: Delegate to Inspector
    ↓
Inspector: AUDIT → [FAIL? → FIX] → Report
    ↓
Commander: Update Memory
    ↓
[More Tasks?] → Repeat
    ↓
MISSION COMPLETE
```

---

## Evidence Requirements

Every completion claim must have proof:

| Action | Required Evidence |
|--------|-------------------|
| Code change | lsp_diagnostics = 0 errors |
| Build | Exit code = 0 |
| Test | All tests pass |
| Agent task | Agent confirms with specific evidence |

**If you cannot provide evidence, the task is NOT complete.**

---

## File Structure

```
src/
├── agents/
│   ├── definitions.ts      # Agent registry
│   ├── orchestrator.ts     # Commander agent
│   └── subagents/
│       ├── architect.ts    # Planning agent
│       ├── builder.ts      # Implementation agent
│       ├── inspector.ts    # Quality + Fix agent
│       └── memory.ts       # Context agent
├── core/
│   ├── state.ts            # Session state
│   └── tasks.ts            # Task graph
├── tools/
│   ├── callAgent.ts        # Agent invocation
│   ├── search.ts           # Grep/glob tools
│   └── slashCommand.ts     # Slash commands
└── index.ts                # Plugin entry
```

---

## Summary

OpenCode Orchestrator is optimized for:

- **Weak models** through structured prompting
- **Autonomous execution** through relentless loop
- **Reliability** through evidence-based completion
- **Efficiency** through parallel task execution
- **Continuity** through persistent memory
