# Architecture Guide: Parallel DAG Orchestration

> Technical documentation for OpenCode Orchestrator's Ultra-Efficient Agentic Architecture

---

## 1. Design Philosophy

Our architecture is built on the principle that **Micro-Tasking + Strict Verification** allows even low-performance LLMs to outperform monolithic models. 

### Key Pillars:
1. **Parallel DAG Execution**: Instead of linear loops, we use a Directed Acyclic Graph (DAG) to execute independent tasks concurrently.
2. **Model Routing**: Routing tasks to the most cost-effective model based on category (Infrastructure, Logic, Integration).
3. **Style Guardian (Strict Review)**: A zero-tolerance policy for style drift and syntax errors.
4. **Self-Healing Recovery**: Autonomous pivot strategies when a specific task fails repeatedly.

---

## 2. Agent Roles (SOP-based)

### 1. Orchestrator (Mission Commander)
**Purpose**: Manages the Task DAG and parallel execution streams.
- **Workflow**: Plan -> Schedule (0 dependencies) -> Parallel Execute -> Verify.
- **Failure Handling**: Triggers pivot strategies (Re-plan/Search) after 3 fails.

### 2. Planner (The Architect)
**Purpose**: Decomposes complex user requests into a JSON-based Task DAG.
- **Output**: JSON array of `Task` objects.
- **Micro-tasking**: Each task MUST touch only one file and have one responsibility.

### 3. Coder (Implementation)
**Purpose**: Executes a single atomic task.
- **Focus**: Pure implementation based on context provided by Searcher.
- **Checks**: Pre-submit checklist for basic syntax and pairings.

### 4. Reviewer (Style Guardian)
**Purpose**: The absolute gatekeeper.
- **Checks**: 5-Point Check (Syntax, Style, Logic, Integrity, Security).
- **Style Enforcement**: Ensures 100% adherence to project conventions (naming, indentation).

### 5. Fixer (Error Resolution)
**Purpose**: Targeted repair based on Reviewer's feedback.
- **Constraint**: Minimal changes only. If it's a syntax error, ONLY fix the syntax.

### 6. Searcher (Context Oracle)
**Purpose**: Proactive context gathering before coding.
- **Tools**: Grep, Glob, AST-based search.

---

## 3. Workflow: From Request to Verified PR

### Step 1: DAG Generation
The **Planner** analyzes the request and generates a JSON DAG:
```json
[
  { "id": "T1", "desc": "Add interface", "deps": [], "type": "infrastructure" },
  { "id": "T2", "desc": "Implement logic", "deps": ["T1"], "type": "logic" }
]
```

### Step 2: Parallel Scheduling
The **Orchestrator** identifies tasks with satisfied dependencies.
- **Batch 1**: T1 executed.
- **Batch 2**: T2 executed (once T1 is ✅ PASS).

### Step 3: Execution Loop (Micro-cycle)
For each task:
1. **Searcher** gathers context.
2. **Coder** implements (with model routing).
3. **Reviewer** performs the 5-point check.
4. (Optional) **Fixer** repairs errors.

---

## 4. Fixed-Model Optimization

This architecture explicitly **avoids** upgrading or switching models. It is designed to make **fixed, low-performance models** (like Phi, Gemma, or GLM-4.7) highly reliable through:
- **Ultra-granularity**: Breaking tasks until they are trivial.
- **Strict Verification**: Reviewer ensures the fixed model hasn't made syntax or style errors.
- **DAG Flow**: Organizing weak outputs into a robust, structured resulting code.

---

## 5. Failure Recovery (Pivot SOP)

| Attempt | Strategy |
|---------|----------|
| **1-2** | Standard Fixer cycle. |
| **3** | **Pivot Level 1**: Call Searcher for similar implementations in history. |
| **4** | **Pivot Level 2**: Call Planner to split the failing task into even smaller units. |
| **5+** | **Circuit Breaker**: Halt and ask user for manual intervention. |

---

## 6. Project Structure

```text
opencode-orchestrator/
├── src/
│   ├── tasks.ts          # DAG Logic & Task Graph
│   └── index.ts          # Plugin Entry & Agent Orchestration
├── crates/
│   ├── orchestrator-core # Rust Core (Grep, Agent Defs, Prompts)
│   └── orchestrator-cli  # CLI tools (Doctor, Installer)
└── docs/
    ├── ARCHITECTURE.md   # This document
    └── REFACTOR_PLAN.md  # Current evolution roadmap
```

---
*OpenCode Orchestrator - Reliability Through Granularity*
