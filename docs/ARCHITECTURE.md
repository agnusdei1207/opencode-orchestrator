# Architecture Guide

> Technical documentation for OpenCode Orchestrator's 6-Agent Collaborative Architecture

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Agent Roles](#agent-roles)
3. [Workflow](#workflow)
4. [Atomic Task Decomposition](#atomic-task-decomposition)
5. [Quality Gate](#quality-gate)
6. [Error Recovery](#error-recovery)
7. [Configuration](#configuration)
8. [Implementation Details](#implementation-details)

---

## Design Philosophy

### The Problem

LLMs struggle with complex coding tasks because:

1. **Long context = more errors**: Large tasks compound mistakes
2. **No verification**: Code may have syntax errors, type mismatches
3. **Single point of failure**: One bad generation ruins everything
4. **Expensive scaling**: Bigger models cost more but aren't always better

### The Solution: Divide & Verify

Instead of one model doing everything:

```
┌─────────────────────────────────────────────────────────────────┐
│  DECOMPOSE  →  IMPLEMENT  →  VERIFY  →  FIX  →  REPEAT          │
│                                                                 │
│  Break into     Execute      Quality     Apply     Until all    │
│  atomic tasks   one at a     gate for    targeted  tasks pass   │
│                 time         each        fixes                  │
└─────────────────────────────────────────────────────────────────┘
```

### Why Cheap Models Work

With proper task decomposition:

| Model | Without Orchestrator | With Orchestrator |
|-------|---------------------|-------------------|
| GLM-4.7 ($0.002/req) | Struggles with complex tasks | Handles them via atomic decomposition |
| GPT-4 ($0.03/req) | Good but expensive | Not necessary for most tasks |

**Key insight**: Small, well-defined tasks with verification work better than throwing compute at the problem.

---

## Agent Roles

### 1. Orchestrator (Team Leader)

**Purpose**: Coordinate all activities, track progress, make decisions.

**Responsibilities**:
- Process user requests
- Delegate to appropriate agents
- Track task completion
- Handle errors and retries
- Adapt strategy when stuck

**When to adapt**:
- Same error 3 times → Stop and report
- Coder confused → Get more context
- Approach not working → Try alternative

---

### 2. Planner (Task Decomposition)

**Purpose**: Break complex tasks into atomic, verifiable units.

**Output Format**:
```
[TASK-001] <action> <target>
├── File: <exact path>
├── Action: <what to do>
├── Success: <verification criteria>
└── Depends: none | TASK-XXX
```

**Atomic Task Properties**:
- One file (or specific location)
- One action (add, fix, update, remove)
- Clear success criteria
- Can be reviewed in isolation

**Examples**:

✅ Good (atomic):
```
[TASK-001] Add validateEmail function
├── File: src/utils/validation.ts
├── Action: Create function that validates email format
├── Success: Function exported, returns boolean
└── Depends: none
```

❌ Bad (too large):
```
[TASK-001] Implement authentication
├── File: src/auth/
├── Action: Add login, logout, registration
├── Success: Auth works
└── Depends: none
```

---

### 3. Searcher (Context Provider)

**Purpose**: Find relevant patterns before coding starts.

**What to find**:
- Similar implementations in codebase
- Import patterns and conventions
- Type definitions in use
- Existing utilities to reuse

**Output**:
```
### Found Patterns

[PATTERN-1] Email validation
File: src/utils/format.ts
Code:
```typescript
export function isValidFormat(value: string): boolean {
  return /^[^\s]+$/.test(value);
}
```

### Recommendations
- Use same export style
- Follow camelCase naming
- Import from utils/format if needed
```

---

### 4. Coder (Implementation)

**Purpose**: Execute one atomic task with complete, working code.

**Pre-submit checklist**:
- [ ] All brackets paired
- [ ] All imports included
- [ ] Matches project style
- [ ] No undefined variables
- [ ] Types correct

**Output**: Complete, runnable code with brief explanation if needed.

---

### 5. Reviewer (Quality Gate)

**Purpose**: Comprehensive error detection after every code change.

**Review Checklist**:

| Category | Checks |
|----------|--------|
| **Syntax** | Brackets closed, quotes matched, valid statements |
| **Imports** | All used modules imported, paths correct |
| **Types** | Type annotations match usage, no implicit any |
| **Logic** | Code does what was asked, edge cases handled |
| **Style** | Matches project conventions |
| **Security** | No hardcoded secrets, input validated |

**Output Format**:

Pass:
```
✅ PASS

Reviewed: validateEmail function in utils/validation.ts
Status: All checks passed
```

Fail:
```
❌ FAIL

[ERROR-001] Syntax
├── File: src/utils/validation.ts
├── Line: 15
├── Issue: Missing closing brace
├── Found: `function validateEmail(email: string) {`
├── Expected: `function validateEmail(email: string) { ... }`
└── Fix: Add closing brace at end of function

[ERROR-002] Import
├── File: src/utils/validation.ts
├── Line: 1
├── Issue: Missing import
├── Found: (no import for RegExp)
├── Expected: Built-in, no import needed
└── Fix: None needed, this is a false positive
```

---

### 6. Fixer (Error Resolution)

**Purpose**: Apply targeted fixes based on reviewer feedback.

**Rules**:
- Fix ALL reported errors
- Minimal changes only
- No unrelated improvements
- No refactoring while fixing

**Output**: Fixed code with list of changes made.

---

## Workflow

### Main Loop (Self-Correcting)

```
START
  │
  ▼
┌────────────────┐
│ Analyze Task   │
└───────┬────────┘
        │
        ▼
┌────────────────┐     Complex?      ┌────────────────┐
│ Direct or Plan │───────────────────▶│ Call Planner   │
└───────┬────────┘     No             └───────┬────────┘
        │              │                       │
        ▼              │                       ▼
┌────────────────┐     │              ┌────────────────┐
│ Single Task    │◀────┘              │ Task List      │
└───────┬────────┘                    └───────┬────────┘
        │                                     │
        ▼                                     ▼
┌─────────────────────────────────────────────────────────┐
│  FOR EACH TASK:                                         │
│                                                         │
│    ┌──────────────┐                                     │
│    │ Need Context?│───Yes──▶ Call Searcher              │
│    └──────┬───────┘                                     │
│           │ No                                          │
│           ▼                                             │
│    ┌──────────────┐                                     │
│    │ Call Coder   │                                     │
│    └──────┬───────┘                                     │
│           │                                             │
│           ▼                                             │
│    ┌──────────────┐                                     │
│    │ Call Reviewer│ ◀─────────────────────────┐         │
│    └──────┬───────┘                           │         │
│           │                                   │         │
│     ┌─────┴─────┐                             │         │
│     │           │                             │         │
│   PASS        FAIL                            │         │
│     │           │                             │         │
│     ▼           ▼                             │         │
│   (next)  ┌──────────────┐                    │         │
│           │ Call Fixer   │────────────────────┘         │
│           └──────┬───────┘        retry ≤ 3             │
│                  │                                      │
│                 retry > 3                               │
│                  │                                      │
│                  ▼                                      │
│           ┌──────────────┐                              │
│           │ STOP & Report│                              │
│           └──────────────┘                              │
│                                                         │
└─────────────────────────────────────────────────────────┘
        │
        ▼
     COMPLETE
```

### Error Recovery Flow

```
Reviewer Reports Error
        │
        ▼
┌────────────────────────────┐
│ Track error by task ID     │
│ Increment retry counter    │
└────────────┬───────────────┘
             │
       ┌─────┴─────┐
       │           │
    retry ≤ 3   retry > 3
       │           │
       ▼           ▼
┌────────────┐  ┌─────────────────┐
│ Call Fixer │  │ STOP            │
└─────┬──────┘  │ Report to user  │
      │         │ Suggest options │
      ▼         └─────────────────┘
┌────────────┐
│ Call       │
│ Reviewer   │──────▶ (loop until PASS or limit)
└────────────┘
```

---

## Atomic Task Decomposition

### What Makes a Task Atomic

| Property | Good | Bad |
|----------|------|-----|
| **Scope** | One file, one function | Multiple files or functions |
| **Action** | "Add X", "Fix Y", "Update Z" | "Implement feature", "Refactor" |
| **Verification** | Can check if done | Vague success criteria |
| **Independence** | Works on its own | Needs other tasks in progress |

### Decomposition Example

**User request**: "Add user authentication with JWT"

**Bad decomposition** (1 task):
```
[TASK-001] Implement JWT authentication
```

**Good decomposition** (atomic tasks):
```
[TASK-001] Create JWT utility functions
├── File: src/utils/jwt.ts
├── Action: Add generateToken and verifyToken functions
├── Success: Functions exported, accept/return correct types
└── Depends: none

[TASK-002] Create password hashing utilities
├── File: src/utils/password.ts
├── Action: Add hashPassword and comparePassword functions
├── Success: Functions work with bcrypt
└── Depends: none

[TASK-003] Create User type interface
├── File: src/types/User.ts
├── Action: Add User interface with id, email, passwordHash
├── Success: Type exported
└── Depends: none

[TASK-004] Create login handler
├── File: src/api/auth/login.ts
├── Action: POST /login - validate credentials, return JWT
├── Success: Returns token on valid login, 401 on invalid
└── Depends: TASK-001, TASK-002, TASK-003

[TASK-005] Create register handler
├── File: src/api/auth/register.ts
├── Action: POST /register - create user with hashed password
├── Success: Returns 201 on success, 400 on duplicate
└── Depends: TASK-002, TASK-003

[TASK-006] Create auth middleware
├── File: src/middleware/auth.ts
├── Action: Verify JWT from Authorization header
├── Success: Attaches user to request or returns 401
└── Depends: TASK-001, TASK-003
```

---

## Quality Gate

### Reviewer Checklist

| Check | What It Catches |
|-------|-----------------|
| **Bracket matching** | `{`, `}`, `(`, `)`, `[`, `]` pairs |
| **Quote matching** | `"`, `'`, `` ` `` properly closed |
| **Statement termination** | Missing semicolons, incomplete statements |
| **Import validation** | Missing imports, wrong paths |
| **Type checking** | Mismatches, implicit any |
| **Logic verification** | Does it do what was asked? |
| **Edge cases** | null, undefined, empty handling |
| **Style consistency** | Matches project conventions |
| **Security basics** | No hardcoded secrets |

### Error Report Format

```
[ERROR-XXX] Category
├── File: Exact file path
├── Line: Line number (if applicable)
├── Issue: What's wrong
├── Found: The problematic code
├── Expected: What it should be
└── Fix: How to fix it
```

---

## Error Recovery

### Circuit Breaker

| Trigger | Action |
|---------|--------|
| Same error 3 times | Stop, report to user |
| 100 iterations | Stop, show progress |
| Unrecoverable error | Stop, suggest alternatives |

### Recovery Strategies

| Situation | Response |
|-----------|----------|
| Syntax error | Fixer applies targeted fix |
| Logic error | Re-examine requirements, possibly re-plan |
| Type error | Fix type or adjust implementation |
| Import missing | Add import statement |
| Stuck in loop | Try different approach |

---

## Configuration

### orchestrator.json

```jsonc
{
  // Override models for specific agents
  "agents": {
    "coder": { 
      "model": "zhipu/glm-4.7",
      "temperature": 0.2
    },
    "reviewer": {
      "model": "anthropic/claude-3-haiku",
      "temperature": 0.1
    }
  },
  
  // Auto mode settings
  "auto": {
    "max_iterations": 100,  // Stop after this many steps
    "max_retries": 3        // Stop after this many same-error retries
  },
  
  // Disable specific features
  "disabled_hooks": []
}
```

### Locations

1. `~/.config/opencode/orchestrator.json` — Global config
2. `.opencode/orchestrator.json` — Per-project override

---

## Implementation Details

### File Structure

```
opencode-orchestrator/
├── src/
│   └── index.ts              # TypeScript plugin (main)
│       ├── AGENTS            # 6 agent definitions
│       ├── callAgentTool     # Agent invocation
│       ├── COMMANDS          # Slash commands
│       └── state             # Session management
│
├── crates/
│   ├── orchestrator-core/    # Rust core library
│   │   └── src/
│   │       ├── agents/       # Agent definitions
│   │       │   ├── definition.rs
│   │       │   ├── prompts.rs
│   │       │   └── manager.rs
│   │       ├── hooks/        # Hook system
│   │       └── tools/        # Search tools
│   │
│   └── orchestrator-cli/     # Rust CLI binary
│       └── src/
│           ├── main.rs
│           └── tools.rs
│
├── bin/                      # Built binaries
├── dist/                     # Built TypeScript
└── docs/                     # Documentation
```

### Agent Permissions

| Agent | Write Files | Run Commands |
|-------|-------------|--------------|
| Orchestrator | ❌ | ❌ |
| Planner | ❌ | ❌ |
| Searcher | ❌ | ❌ |
| Coder | ✅ | ✅ |
| Reviewer | ❌ | ✅ (for testing) |
| Fixer | ✅ | ✅ |

### State Tracking

Each session tracks:
- `enabled`: Auto mode active
- `iterations`: Steps taken
- `taskRetries`: Error counts per task
- `currentTask`: Active task ID
