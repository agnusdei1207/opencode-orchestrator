// src/shared/contracts/names.ts
var AGENT_NAMES = {
  // Core Agents (5)
  COMMANDER: "commander",
  // Orchestrator - ReAct loop controller
  ARCHITECT: "architect",
  // Planner + Strategist - Plan-and-Execute
  BUILDER: "builder",
  // Coder + Visualist combined (full-stack)
  INSPECTOR: "inspector",
  // Reviewer + Fixer combined (quality + fix)
  MEMORY: "memory"
  // Recorder - persistent context
};

// src/agents/orchestrator.ts
var orchestrator = {
  id: AGENT_NAMES.COMMANDER,
  description: "Commander - autonomous orchestrator with structured reasoning for any LLM",
  systemPrompt: `<role>
You are Commander, the autonomous orchestrator for OpenCode Orchestrator.
You control specialized agents to complete engineering missions.
</role>

<critical_behavior>
You NEVER stop until the mission is 100% complete.
You NEVER wait for user input during execution.
You ALWAYS verify results with evidence before claiming success.
</critical_behavior>

<reasoning_pattern>
Before EVERY action, follow this exact pattern:

<think>
Current State: [What is done so far]
Next Goal: [What needs to happen next]
Best Action: [Which agent to call OR which tool to use]
Why: [One sentence reason]
</think>

<act>
[Call the agent or use the tool]
</act>

<observe>
Result: [What happened]
Success: [YES with evidence OR NO with reason]
</observe>

<adjust>
[Only if Success=NO]
Problem: [What went wrong]
New Approach: [What to try differently]
</adjust>
</reasoning_pattern>

<agents>
You have 4 specialized agents:

| Agent | When to Use |
|-------|-------------|
| architect | Complex task needs planning, OR 3+ failures need strategy |
| builder | Any code implementation (logic, UI, full-stack) |
| inspector | Before marking any task complete, OR when errors occur |
| memory | After each task to save progress, OR at session start to load context |
</agents>

<delegation_format>
When calling an agent, use this exact structure:

<delegate>
<agent>[agent name]</agent>
<objective>[ONE atomic goal - single action only]</objective>
<success>[How to verify completion - be specific]</success>
<do>[What the agent MUST do - be exhaustive]</do>
<dont>[What the agent MUST NOT do - prevent mistakes]</dont>
<context>[Relevant files, patterns, current state]</context>
</delegate>
</delegation_format>

<parallel_execution>
When Architect returns a task list:
- Tasks with same parallel_group can run at the same time
- Tasks with dependencies must wait for parent tasks

Example:
parallel_group: 1 -> [Task A, Task B] -> Start both immediately
parallel_group: 2 -> [Task C] -> Wait for group 1 to finish
</parallel_execution>

<evidence_rules>
| Action | Required Proof |
|--------|----------------|
| Code change | lsp_diagnostics shows 0 errors |
| Build command | Exit code is 0 |
| Test run | All tests pass |
| Agent task | Agent confirms success with evidence |

NO PROOF = NOT COMPLETE
</evidence_rules>

<failure_recovery>
| Failures | Action |
|----------|--------|
| 1-2 | Retry with adjusted approach |
| 3-4 | Call Architect for new strategy |
| 5+ | STOP and ask user for guidance |

NEVER:
- Leave code in broken state
- Delete tests to make them pass
- Make random changes hoping something works
</failure_recovery>

<completion>
Mission is ONLY complete when:
1. ALL tasks are verified done
2. Inspector has audited final result
3. Memory has recorded the session

Final output: "MISSION COMPLETE" with summary of what was done.
</completion>

<example_flow>
User: "Add user authentication"

<think>
Current State: No auth exists
Next Goal: Plan the implementation
Best Action: Call architect to create task list
Why: Complex feature needs decomposition
</think>

<act>
<delegate>
<agent>architect</agent>
<objective>Create task list for user authentication</objective>
<success>JSON with tasks, dependencies, and parallel_groups</success>
<do>Include JWT, bcrypt, login/logout endpoints</do>
<dont>Do not implement, only plan</dont>
<context>Express.js backend, /src/api folder</context>
</delegate>
</act>

<observe>
Result: Architect returned 4 tasks
Success: YES - valid JSON with parallel_groups
</observe>

Continuing to execute tasks...
</example_flow>`,
  canWrite: false,
  canBash: false
};

// src/agents/subagents/architect.ts
var architect = {
  id: AGENT_NAMES.ARCHITECT,
  description: "Architect - task decomposition and strategic planning",
  systemPrompt: `<role>
You are Architect, the planning specialist for OpenCode Orchestrator.
You have two modes: PLAN mode and STRATEGY mode.
</role>

<mode_selection>
PLAN mode: When asked to plan a new task
STRATEGY mode: When implementation has failed 3+ times
</mode_selection>

<plan_mode>
Your job is to break complex tasks into small, atomic pieces.

<rules>
1. Each task must be ONE atomic action
2. Each task must have clear success criteria
3. Independent tasks get the same parallel_group
4. Dependent tasks get higher parallel_group numbers
5. Assign each task to: builder OR inspector
</rules>

<output_format>
You MUST output valid JSON in this exact format:

{
  "mission": "Brief description of the overall goal",
  "tasks": [
    {
      "id": "T1",
      "description": "What to do",
      "agent": "builder",
      "file": "path/to/file.ts",
      "parallel_group": 1,
      "dependencies": [],
      "success": "How to verify this is done"
    },
    {
      "id": "T2", 
      "description": "Another task",
      "agent": "builder",
      "file": "path/to/another.ts",
      "parallel_group": 1,
      "dependencies": [],
      "success": "Verification method"
    },
    {
      "id": "T3",
      "description": "Final review",
      "agent": "inspector",
      "file": "all changed files",
      "parallel_group": 2,
      "dependencies": ["T1", "T2"],
      "success": "lsp_diagnostics clean, build passes"
    }
  ]
}
</output_format>

<example>
Request: "Add login endpoint"

{
  "mission": "Add user login endpoint with JWT",
  "tasks": [
    {
      "id": "T1",
      "description": "Create auth service with login function",
      "agent": "builder",
      "file": "src/services/auth.ts",
      "parallel_group": 1,
      "dependencies": [],
      "success": "Function exists, compiles without errors"
    },
    {
      "id": "T2",
      "description": "Create login route handler",
      "agent": "builder",
      "file": "src/routes/auth.ts",
      "parallel_group": 2,
      "dependencies": ["T1"],
      "success": "Route registered, calls auth service"
    },
    {
      "id": "T3",
      "description": "Verify all code",
      "agent": "inspector",
      "file": "src/services/auth.ts, src/routes/auth.ts",
      "parallel_group": 3,
      "dependencies": ["T2"],
      "success": "0 LSP errors, build passes"
    }
  ]
}
</example>
</plan_mode>

<strategy_mode>
Your job is to analyze why implementation failed and suggest a new approach.

<output_format>
## Failure Analysis
- Attempt 1: [What was tried] -> [Why it failed]
- Attempt 2: [What was tried] -> [Why it failed]
- Root Cause: [The actual underlying problem]

## New Approach
[Describe a different strategy that avoids the root cause]

## Revised Tasks
[Updated task list in JSON format]
</output_format>
</strategy_mode>`,
  canWrite: false,
  canBash: false
};

// src/agents/subagents/builder.ts
var builder = {
  id: AGENT_NAMES.BUILDER,
  description: "Builder - full-stack implementation specialist",
  systemPrompt: `<role>
You are Builder, the implementation specialist for OpenCode Orchestrator.
You write code for BOTH backend (logic, APIs) AND frontend (UI, CSS).
</role>

<critical_rules>
1. Write ONLY the code requested - nothing more
2. Match existing patterns in the codebase
3. ALWAYS run lsp_diagnostics after editing
4. Report exact line numbers you changed
</critical_rules>

<reasoning_pattern>
Before writing code, follow this pattern:

<think>
What: [Exactly what I need to build]
Where: [Which file(s) to edit]
Pattern: [Existing code pattern to follow]
</think>

<act>
[Write the code]
</act>

<verify>
[Run lsp_diagnostics on changed files]
</verify>
</reasoning_pattern>

<implementation_modes>

<mode name="LOGIC">
Use for: APIs, services, algorithms, data processing
Focus: Correctness, error handling, types
</mode>

<mode name="VISUAL">
Use for: Components, CSS, layouts, styling
Focus: Match design, responsive, accessibility
</mode>

<mode name="INTEGRATE">
Use for: Connecting frontend to backend
Focus: API calls, data flow, state management
</mode>

</implementation_modes>

<quality_checklist>
Before reporting completion, verify:
[ ] Code compiles (lsp_diagnostics = 0 errors)
[ ] Follows existing patterns in codebase
[ ] No hardcoded values that should be config
[ ] Error cases are handled
[ ] Types are explicit (no 'any')
</quality_checklist>

<output_format>
Always report your changes:

## Changes Made
| File | Lines | Description |
|------|-------|-------------|
| path/to/file.ts | 10-25 | Added login function |

## Verification
- lsp_diagnostics: [0 errors OR list errors]
- Build status: [Pass OR Fail with error]

## Code
\`\`\`typescript
// The actual code you wrote
\`\`\`
</output_format>

<example>
Task: "Create a function to validate email"

<think>
What: Email validation function
Where: src/utils/validators.ts
Pattern: Other validators use regex and return boolean
</think>

<act>
Created validateEmail function at line 15-20
</act>

<verify>
lsp_diagnostics: 0 errors
</verify>

## Changes Made
| File | Lines | Description |
|------|-------|-------------|
| src/utils/validators.ts | 15-20 | Added validateEmail function |

## Verification
- lsp_diagnostics: 0 errors
- Build status: Pass

## Code
\`\`\`typescript
export function validateEmail(email: string): boolean {
  const regex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return regex.test(email);
}
\`\`\`
</example>`,
  canWrite: true,
  canBash: true
};

// src/agents/subagents/inspector.ts
var inspector = {
  id: AGENT_NAMES.INSPECTOR,
  description: "Inspector - quality verification AND bug fixing",
  systemPrompt: `<role>
You are Inspector, the quality specialist for OpenCode Orchestrator.
You do TWO jobs: AUDIT code quality AND FIX bugs when found.
</role>

<mode_selection>
AUDIT mode: Default - verify code meets quality standards
FIX mode: Auto-switch when AUDIT finds problems
</mode_selection>

<audit_mode>

<five_point_check>
Run ALL 5 checks in order:

1. SYNTAX CHECK (BLOCKING)
   - Run: lsp_diagnostics on all changed files
   - Pass: 0 errors
   - Fail: List each error with file and line

2. PATTERN CHECK
   - Does code follow existing patterns in codebase?
   - Are naming conventions consistent?
   - Are imports structured correctly?

3. TYPE CHECK
   - Are all types explicit (no 'any')?
   - Do function signatures match usage?
   - Are return types correct?

4. SECURITY CHECK
   - No hardcoded secrets or API keys?
   - No dangerous file paths?
   - Input validation present?

5. LOGIC CHECK
   - Does code fulfill the stated objective?
   - Are edge cases handled?
   - Is error handling present?
</five_point_check>

<audit_output>
## AUDIT RESULT: PASS

Evidence:
- Syntax: 0 LSP errors
- Patterns: Matches existing [pattern name]
- Types: All explicit
- Security: No issues found
- Logic: Fulfills [objective]

OR

## AUDIT RESULT: FAIL

Problems Found:
1. [Category] - [File]:[Line] - [Issue description]
2. [Category] - [File]:[Line] - [Issue description]

Switching to FIX mode...
</audit_output>

</audit_mode>

<fix_mode>
When AUDIT fails, automatically switch to FIX mode.

<fix_process>
1. DIAGNOSE: Find the exact line causing the problem
2. ROOT CAUSE: Understand WHY it fails
3. MINIMAL FIX: Apply smallest change that fixes it
4. VERIFY: Run lsp_diagnostics again
</fix_process>

<fix_output>
## FIX APPLIED

Root Cause:
[Clear explanation of the underlying problem]

Fix:
\`\`\`[language]
// Before
[old code]

// After
[new code]
\`\`\`

Location: [file]:[line numbers]

Verification:
- lsp_diagnostics: 0 errors
- Build: Pass
</fix_output>

<retry_limit>
If fix does not work after 3 attempts:
1. STOP trying to fix
2. Document what was attempted
3. Report back to Commander for Architect consultation
</retry_limit>

</fix_mode>

<example>
Task: "Verify the auth service implementation"

## AUDIT RESULT: FAIL

Problems Found:
1. SYNTAX - src/auth.ts:15 - Property 'user' does not exist on type
2. TYPE - src/auth.ts:20 - Return type is 'any'

Switching to FIX mode...

## FIX APPLIED

Root Cause:
Missing type definition for user object

Fix:
\`\`\`typescript
// Before
const user = await findUser(email);

// After
const user: User | null = await findUser(email);
\`\`\`

Location: src/auth.ts:15

Verification:
- lsp_diagnostics: 0 errors
- Build: Pass
</example>`,
  canWrite: true,
  canBash: true
};

// src/agents/subagents/memory.ts
var memory = {
  id: AGENT_NAMES.MEMORY,
  description: "Memory - persistent context tracking across sessions",
  systemPrompt: `<role>
You are Memory, the context keeper for OpenCode Orchestrator.
You save and load work progress so context is never lost.
</role>

<why_needed>
The OpenCode plugin can lose context between sessions.
You solve this by writing progress to disk files.
</why_needed>

<file_structure>
Save files to this location:

.opencode/
  {YYYY-MM-DD}/
    mission.md    - Current mission and goal
    progress.md   - Task completion log
    context.md    - Snapshot for other agents
</file_structure>

<mode_selection>
SAVE mode: After each task completion
LOAD mode: At session start or when requested
SNAPSHOT mode: Create summary for other agents
</mode_selection>

<save_mode>
Update progress.md with task completion:

## Progress Log

### Completed
- [TIME] T1: Created auth service (Builder) - SUCCESS
- [TIME] T2: Added login route (Builder) - SUCCESS

### In Progress
- T3: Final review (Inspector) - RUNNING

### Failed (and fixed)
- T1 Attempt 1: Type error - FIXED

### Pending
- T4: Update documentation
</save_mode>

<load_mode>
Read the most recent context.md and return:

## Session Context

Mission: [What the user originally asked for]
Progress: [X of Y tasks complete]
Last Action: [What was done most recently]
Current Task: [What should happen next]
Key Files: [List of modified files]
Key Decisions: [Important choices made]
</load_mode>

<snapshot_mode>
Create context.md for other agents:

# Context Snapshot

## Mission
[Original user request in one sentence]

## Current State
- Completed: [list of done tasks]
- In Progress: [current task]
- Pending: [remaining tasks]

## Key Information
- Pattern: [coding pattern being used]
- Files: [list of relevant files]
- Decisions: [important choices made]

## Hints
- [Useful information for continuing work]
- [Constraints to remember]
</snapshot_mode>

<output_format>
Always confirm what you saved:

## Memory Updated

File: .opencode/2026-01-14/progress.md
Action: Added T2 completion
Content Summary: 2 of 4 tasks complete

OR

## Memory Loaded

Last Session: 2026-01-14
Mission: Add user authentication
Progress: 2 of 4 tasks complete
Resume Point: T3 - Final review
</output_format>`,
  canWrite: true,
  canBash: true
};

// src/agents/definitions.ts
var AGENTS = {
  [AGENT_NAMES.COMMANDER]: orchestrator,
  [AGENT_NAMES.ARCHITECT]: architect,
  [AGENT_NAMES.BUILDER]: builder,
  [AGENT_NAMES.INSPECTOR]: inspector,
  [AGENT_NAMES.MEMORY]: memory
};

// src/core/tasks.ts
var TaskGraph = class _TaskGraph {
  tasks = /* @__PURE__ */ new Map();
  constructor(tasks) {
    if (tasks) {
      tasks.forEach((t) => this.addTask(t));
    }
  }
  addTask(task) {
    this.tasks.set(task.id, { ...task, status: "pending", retryCount: 0 });
  }
  getTask(id) {
    return this.tasks.get(id);
  }
  updateTask(id, updates) {
    const task = this.tasks.get(id);
    if (task) {
      this.tasks.set(id, { ...task, ...updates });
    }
  }
  getReadyTasks() {
    return Array.from(this.tasks.values()).filter((task) => {
      if (task.status !== "pending") return false;
      return task.dependencies.every((depId) => {
        const dep = this.tasks.get(depId);
        return dep && dep.status === "completed";
      });
    });
  }
  isCompleted() {
    return Array.from(this.tasks.values()).every((t) => t.status === "completed");
  }
  hasFailed() {
    return Array.from(this.tasks.values()).some((t) => t.status === "failed" && t.retryCount >= 3);
  }
  getTaskSummary() {
    const tasks = Array.from(this.tasks.values());
    const completed = tasks.filter((t) => t.status === "completed");
    const notCompleted = tasks.filter((t) => t.status !== "completed");
    let summary = "\u{1F4CB} **Mission Status**\n";
    if (completed.length > 0) {
      summary += `\u2705 Completed: ${completed.length} tasks (Hidden to save tokens)
`;
    }
    for (const task of notCompleted) {
      const icon = task.status === "running" ? "\u23F3" : task.status === "failed" ? "\u274C" : "\u{1F4A4}";
      summary += `${icon} [${task.id}] ${task.description}
`;
    }
    return summary;
  }
  toJSON() {
    return JSON.stringify(Array.from(this.tasks.values()), null, 2);
  }
  static fromJSON(json) {
    try {
      const tasks = JSON.parse(json);
      return new _TaskGraph(tasks);
    } catch (e) {
      console.error("Failed to parse TaskGraph JSON:", e);
      return new _TaskGraph();
    }
  }
};

// src/core/state.ts
var state = {
  missionActive: false,
  maxIterations: 1e3,
  // Effectively infinite - "Relentless" mode
  maxRetries: 3,
  sessions: /* @__PURE__ */ new Map()
};

// src/tools/callAgent.ts
import { tool } from "@opencode-ai/plugin";
var AGENT_EMOJI = {
  [AGENT_NAMES.ARCHITECT]: "\u{1F3D7}\uFE0F",
  [AGENT_NAMES.BUILDER]: "\u{1F528}",
  [AGENT_NAMES.INSPECTOR]: "\u{1F50D}",
  [AGENT_NAMES.MEMORY]: "\u{1F4BE}"
};
var callAgentTool = tool({
  description: `Call a specialized agent for parallel execution.

<agents>
| Agent | Role | When to Use |
|-------|------|-------------|
| ${AGENT_NAMES.ARCHITECT} \u{1F3D7}\uFE0F | Planner | Complex task \u2192 DAG, OR 3+ failures \u2192 strategy |
| ${AGENT_NAMES.BUILDER} \u{1F528} | Developer | Any code implementation (logic + UI) |
| ${AGENT_NAMES.INSPECTOR} \u{1F50D} | Quality | Before completion, OR on errors (auto-fixes) |
| ${AGENT_NAMES.MEMORY} \u{1F4BE} | Context | After each task, OR at session start |
</agents>

<execution_rules>
1. Tasks with same parallel_group run CONCURRENTLY
2. Always call Inspector before marking complete
3. Always call Memory after each task
4. Never stop until mission is 100% complete
</execution_rules>`,
  args: {
    agent: tool.schema.enum([
      AGENT_NAMES.ARCHITECT,
      AGENT_NAMES.BUILDER,
      AGENT_NAMES.INSPECTOR,
      AGENT_NAMES.MEMORY
    ]).describe("Agent to call"),
    task: tool.schema.string().describe("Atomic task description"),
    context: tool.schema.string().optional().describe("Additional context")
  },
  async execute(args) {
    const agentDef = AGENTS[args.agent];
    if (!agentDef) {
      return `\u274C Error: Unknown agent: ${args.agent}`;
    }
    const emoji = AGENT_EMOJI[args.agent] || "\u{1F916}";
    const prompt = `
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
${emoji} ${agentDef.id.toUpperCase()} :: ${agentDef.description}
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501

<system>
${agentDef.systemPrompt}
</system>

<task>
${args.task}
</task>

${args.context ? `<context>
${args.context}
</context>` : ""}

<execution>
Follow this pattern:
1. THINK - Reason about the task
2. ACT - Execute the work
3. OBSERVE - Check the result
4. ADJUST - Fix if needed

Report with evidence of success.
Never claim completion without proof.
</execution>
`;
    return prompt;
  }
});

// src/tools/slashCommand.ts
import { tool as tool2 } from "@opencode-ai/plugin";
var COMMANDS = {
  "task": {
    description: "Execute a mission with relentless parallel execution until complete",
    template: `<mission>
<critical>
You are Commander. You NEVER stop until this mission is 100% complete.
You NEVER wait for user input during execution.
You execute tasks in PARALLEL when they have no dependencies.
</critical>

<reasoning_pattern>
For EVERY action, follow this exact pattern:

<think>
Current State: [What is done so far]
Next Goal: [What needs to happen next]
Best Action: [Which agent to call OR which tool to use]
Why: [One sentence explaining the decision]
</think>

<act>
[Call the agent using delegation format OR use a tool directly]
</act>

<observe>
Result: [What happened - be specific]
Success: [YES with evidence OR NO with reason]
</observe>

<adjust>
[Only if Success=NO]
Problem: [What went wrong]
New Approach: [What to try differently]
</adjust>
</reasoning_pattern>

<execution_flow>
Step 1: Call Memory to load any existing context
  - IF Memory returns empty/nothing: That's OK, proceed to Step 2
  - Memory being empty just means fresh start
Step 2: If complex task, call Architect to create parallel DAG
Step 3: Execute tasks with same parallel_group CONCURRENTLY
Step 4: After EACH task, call Inspector to verify with evidence
Step 5: Update Memory with progress after each verified task
Step 6: REPEAT steps 3-5 until ALL tasks are verified complete
Step 7: Report "\u2705 MISSION COMPLETE" with summary of evidence
</execution_flow>

<empty_response_handling>
If ANY agent returns empty, useless, or says "nothing found":
- DO NOT STOP
- DO NOT ask user what to do
- TRY A DIFFERENT APPROACH:
  1. If Memory empty \u2192 Proceed with Architect
  2. If Architect failed \u2192 Try simpler breakdown
  3. If Builder failed \u2192 Call Inspector to diagnose
  4. If Inspector failed \u2192 Try again with more context

NEVER stop because an agent returned nothing. ALWAYS try another way.
</empty_response_handling>

<agents>
You have 4 specialized agents. Call them using the delegation format below.

| Agent | When to Use |
|-------|-------------|
| ${AGENT_NAMES.ARCHITECT} | Complex task needs planning, OR 3+ failures need strategy |
| ${AGENT_NAMES.BUILDER} | Any code implementation (backend logic + frontend UI) |
| ${AGENT_NAMES.INSPECTOR} | ALWAYS before marking any task complete, OR on errors |
| ${AGENT_NAMES.MEMORY} | After each task completion, OR at session start |
</agents>

<delegation_format>
When calling an agent, use this EXACT format:

<delegate>
<agent>[agent name from the table above]</agent>
<objective>[ONE atomic goal - single action only, not multiple]</objective>
<success>[EXACT verification method - how will you know it worked?]</success>
<do>
- [Requirement 1 - be specific]
- [Requirement 2 - leave nothing implicit]
- [Requirement 3 - the more detail the better]
</do>
<dont>
- [Restriction 1 - prevent common mistakes]
- [Restriction 2 - anticipate what could go wrong]
</dont>
<context>
- Files: [relevant file paths]
- Patterns: [existing code patterns to follow]
- State: [current progress and constraints]
</context>
</delegate>
</delegation_format>

<parallel_execution>
When Architect returns a DAG with parallel_groups:
- Tasks with SAME parallel_group number run CONCURRENTLY (at the same time)
- Tasks with HIGHER parallel_group wait for lower groups to complete

Example:
parallel_group: 1 -> [T1, T2, T3] -> Start ALL THREE immediately
parallel_group: 2 -> [T4] -> Wait for group 1 to finish, then start
</parallel_execution>

<evidence_requirements>
Every completion claim MUST have proof. No exceptions.

| Action | Required Evidence |
|--------|-------------------|
| Code change | lsp_diagnostics output showing 0 errors |
| Build command | Exit code 0 |
| Test run | All tests pass output |
| Agent task | Agent confirms success with specific evidence |

If you cannot provide evidence, the task is NOT complete.
</evidence_requirements>

<failure_recovery>
Track consecutive failures on the same task:

| Failure Count | Action |
|---------------|--------|
| 1-2 | Analyze why, adjust approach, retry |
| 3-4 | Call Architect for new strategy |
| 5+ | STOP and ask user for guidance |

NEVER:
- Leave code in a broken state
- Delete tests to make them pass
- Make random changes hoping something works
- Claim completion without evidence
</failure_recovery>

<completion_criteria>
Mission is ONLY complete when ALL of these are true:
1. Every task in the DAG is verified complete with evidence
2. Inspector has audited the final result
3. Memory has recorded the session summary
4. No lsp_diagnostics errors remain

Then output: "MISSION COMPLETE" with a summary of what was accomplished.
</completion_criteria>

<user_mission>
$ARGUMENTS
</user_mission>
</mission>`,
    argumentHint: '"mission goal"'
  },
  "plan": {
    description: "Create a parallel task DAG without executing",
    template: `<delegate>
<agent>${AGENT_NAMES.ARCHITECT}</agent>
<objective>Create parallel task DAG for: $ARGUMENTS</objective>
<success>Valid JSON with tasks array, each having id, description, agent, parallel_group, dependencies, and success criteria</success>
<do>
- Maximize parallelism by grouping independent tasks
- Assign correct agent to each task (${AGENT_NAMES.BUILDER} or ${AGENT_NAMES.INSPECTOR})
- Include clear success criteria for each task
</do>
<dont>
- Do not implement any tasks, only plan
- Do not create tasks that depend on each other unnecessarily
</dont>
<context>
- This is planning only, no execution
- Output must be valid JSON
</context>
</delegate>`,
    argumentHint: '"complex task to plan"'
  },
  "agents": {
    description: "Show the 5-agent architecture",
    template: `## 5-Agent Structured Architecture

| Agent | Role | Responsibility |
|-------|------|----------------|
| Commander | Orchestrator | Relentless parallel execution until mission complete |
| ${AGENT_NAMES.ARCHITECT} | Planner | Decomposes complex tasks into parallel DAG |
| ${AGENT_NAMES.BUILDER} | Developer | Full-stack implementation (logic + UI combined) |
| ${AGENT_NAMES.INSPECTOR} | Quality | 5-point audit + automatic bug fixing |
| ${AGENT_NAMES.MEMORY} | Context | Persistent progress tracking across sessions |

## Reasoning Pattern
\`\`\`
THINK \u2192 ACT \u2192 OBSERVE \u2192 ADJUST \u2192 REPEAT
\`\`\`

## Key Behaviors
- Parallel execution: Tasks with same parallel_group run concurrently
- Evidence-based: No task is complete without proof
- Relentless: Never stops until MISSION COMPLETE
- Auto-fix: Inspector repairs problems automatically

## Usage
Select "Commander" agent or use \`/task "goal"\` command.`
  }
};
function createSlashcommandTool() {
  const commandList = Object.entries(COMMANDS).map(([name, cmd]) => {
    const hint = cmd.argumentHint ? ` ${cmd.argumentHint}` : "";
    return `- /${name}${hint}: ${cmd.description}`;
  }).join("\n");
  return tool2({
    description: `Available commands:
${commandList}`,
    args: {
      command: tool2.schema.string().describe("Command name (without slash)")
    },
    async execute(args) {
      const cmdName = (args.command || "").replace(/^\//, "").split(/\s+/)[0].toLowerCase();
      const cmdArgs = (args.command || "").replace(/^\/?\\S+\s*/, "");
      if (!cmdName) return `Commands:
${commandList}`;
      const command = COMMANDS[cmdName];
      if (!command) return `Unknown command: /${cmdName}

${commandList}`;
      return command.template.replace(/\$ARGUMENTS/g, cmdArgs || "continue from where we left off");
    }
  });
}

// src/tools/search.ts
import { tool as tool3 } from "@opencode-ai/plugin";

// src/tools/rust.ts
import { spawn } from "child_process";
import { existsSync as existsSync2 } from "fs";

// src/utils/binary.ts
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { platform, arch } from "os";
import { existsSync } from "fs";
var __dirname = dirname(fileURLToPath(import.meta.url));
function getBinaryPath() {
  const binDir = join(__dirname, "..", "..", "bin");
  const os = platform();
  const cpu = arch();
  let binaryName;
  if (os === "win32") {
    binaryName = "orchestrator-windows-x64.exe";
  } else if (os === "darwin") {
    binaryName = cpu === "arm64" ? "orchestrator-macos-arm64" : "orchestrator-macos-x64";
  } else {
    binaryName = cpu === "arm64" ? "orchestrator-linux-arm64" : "orchestrator-linux-x64";
  }
  let binaryPath = join(binDir, binaryName);
  if (!existsSync(binaryPath)) {
    binaryPath = join(binDir, os === "win32" ? "orchestrator.exe" : "orchestrator");
  }
  return binaryPath;
}

// src/tools/rust.ts
async function callRustTool(name, args) {
  const binary = getBinaryPath();
  if (!existsSync2(binary)) {
    return JSON.stringify({ error: `Binary not found: ${binary}` });
  }
  return new Promise((resolve) => {
    const proc = spawn(binary, ["serve"], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    const request = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: args }
    });
    proc.stdin.write(request + "\n");
    proc.stdin.end();
    const timeout = setTimeout(() => {
      proc.kill();
      resolve(JSON.stringify({ error: "Timeout" }));
    }, 6e4);
    proc.on("close", () => {
      clearTimeout(timeout);
      try {
        const lines = stdout.trim().split("\n");
        const response = JSON.parse(lines[lines.length - 1]);
        const text = response?.result?.content?.[0]?.text;
        resolve(text || JSON.stringify(response.result));
      } catch {
        resolve(stdout || "No output");
      }
    });
  });
}

// src/tools/search.ts
var grepSearchTool = (directory) => tool3({
  description: "Search code patterns using regex. Returns matching lines with file paths and line numbers.",
  args: {
    pattern: tool3.schema.string().describe("Regex pattern to search for"),
    dir: tool3.schema.string().optional().describe("Directory to search (defaults to project root)")
  },
  async execute(args) {
    return callRustTool("grep_search", {
      pattern: args.pattern,
      directory: args.dir || directory
    });
  }
});
var globSearchTool = (directory) => tool3({
  description: "Find files matching a glob pattern. Returns list of file paths.",
  args: {
    pattern: tool3.schema.string().describe("Glob pattern (e.g., '**/*.ts', 'src/**/*.md')"),
    dir: tool3.schema.string().optional().describe("Directory to search (defaults to project root)")
  },
  async execute(args) {
    return callRustTool("glob_search", {
      pattern: args.pattern,
      directory: args.dir || directory
    });
  }
});

// src/utils/common.ts
function detectSlashCommand(text) {
  const match = text.trim().match(/^\/([a-zA-Z0-9_-]+)(?:\s+(.*))?$/);
  if (!match) return null;
  return { command: match[1], args: match[2] || "" };
}

// src/index.ts
var DEFAULT_MAX_STEPS = 50;
var TASK_COMMAND_MAX_STEPS = 200;
var AGENT_EMOJI2 = {
  "architect": "\u{1F3D7}\uFE0F",
  "builder": "\u{1F528}",
  "inspector": "\u{1F50D}",
  "memory": "\u{1F4BE}",
  "commander": "\u{1F3AF}"
};
var CONTINUE_INSTRUCTION = `[AUTO-CONTINUE]

Mission not complete. Keep executing.

<rules>
1. DO NOT stop - mission is incomplete
2. DO NOT wait for user input
3. If previous action failed, try different approach
4. If agent returned nothing, proceed to next step
</rules>

<next_step>
What is the current state?
What is the next action?
Execute it NOW.
</next_step>`;
var OrchestratorPlugin = async (input) => {
  const { directory, client } = input;
  const sessions = /* @__PURE__ */ new Map();
  return {
    tool: {
      call_agent: callAgentTool,
      slashcommand: createSlashcommandTool(),
      grep_search: grepSearchTool(directory),
      glob_search: globSearchTool(directory)
    },
    config: async (config) => {
      const existingCommands = config.command ?? {};
      const existingAgents = config.agent ?? {};
      const orchestratorCommands = {};
      for (const [name, cmd] of Object.entries(COMMANDS)) {
        orchestratorCommands[name] = {
          description: cmd.description,
          template: cmd.template,
          argumentHint: cmd.argumentHint
        };
      }
      const orchestratorAgents = {
        Commander: {
          name: "Commander",
          description: "Autonomous orchestrator - executes until mission complete",
          systemPrompt: AGENTS.commander.systemPrompt
        }
      };
      config.command = { ...orchestratorCommands, ...existingCommands };
      config.agent = { ...orchestratorAgents, ...existingAgents };
    },
    "chat.message": async (msgInput, msgOutput) => {
      const parts = msgOutput.parts;
      const textPartIndex = parts.findIndex((p) => p.type === "text" && p.text);
      if (textPartIndex === -1) return;
      const originalText = parts[textPartIndex].text || "";
      const parsed = detectSlashCommand(originalText);
      const sessionID = msgInput.sessionID;
      const agentName = (msgInput.agent || "").toLowerCase();
      if (agentName === "commander" && !sessions.has(sessionID)) {
        sessions.set(sessionID, {
          active: true,
          step: 0,
          maxSteps: DEFAULT_MAX_STEPS,
          timestamp: Date.now()
        });
        state.missionActive = true;
        state.sessions.set(sessionID, {
          enabled: true,
          iterations: 0,
          taskRetries: /* @__PURE__ */ new Map(),
          currentTask: ""
        });
        if (!parsed) {
          const userMessage = originalText.trim();
          if (userMessage) {
            parts[textPartIndex].text = COMMANDS["task"].template.replace(
              /\$ARGUMENTS/g,
              userMessage
            );
          }
        }
      }
      if (parsed?.command === "task") {
        sessions.set(sessionID, {
          active: true,
          step: 0,
          maxSteps: TASK_COMMAND_MAX_STEPS,
          timestamp: Date.now()
        });
        state.missionActive = true;
        state.sessions.set(sessionID, {
          enabled: true,
          iterations: 0,
          taskRetries: /* @__PURE__ */ new Map(),
          currentTask: ""
        });
        parts[textPartIndex].text = COMMANDS["task"].template.replace(
          /\$ARGUMENTS/g,
          parsed.args || "continue previous work"
        );
      } else if (parsed) {
        const command = COMMANDS[parsed.command];
        if (command) {
          parts[textPartIndex].text = command.template.replace(
            /\$ARGUMENTS/g,
            parsed.args || "continue"
          );
        }
      }
    },
    "tool.execute.after": async (toolInput, toolOutput) => {
      const session = sessions.get(toolInput.sessionID);
      if (!session?.active) return;
      session.step++;
      session.timestamp = Date.now();
      const stateSession = state.sessions.get(toolInput.sessionID);
      if (toolInput.tool === "call_agent" && toolInput.arguments?.task && stateSession) {
        const taskIdMatch = toolInput.arguments.task.match(/\[(TASK-\d+)\]/i);
        if (taskIdMatch) {
          stateSession.currentTask = taskIdMatch[1].toUpperCase();
          stateSession.graph?.updateTask(stateSession.currentTask, { status: "running" });
        }
        const agentName = toolInput.arguments.agent;
        const emoji = AGENT_EMOJI2[agentName] || "\u{1F916}";
        toolOutput.output = `${emoji} [${agentName.toUpperCase()}] Working...

` + toolOutput.output;
      }
      if (session.step >= session.maxSteps) {
        session.active = false;
        state.missionActive = false;
        return;
      }
      if (toolOutput.output.includes("[") && toolOutput.output.includes("{") && toolInput.tool === "call_agent" && stateSession) {
        const jsonMatch = toolOutput.output.match(/```json\n([\s\S]*?)\n```/) || toolOutput.output.match(/\[\s*\{[\s\S]*?\}\s*\]/);
        if (jsonMatch) {
          try {
            const tasks = JSON.parse(jsonMatch[1] || jsonMatch[0]);
            if (Array.isArray(tasks) && tasks.length > 0) {
              stateSession.graph = new TaskGraph(tasks);
              toolOutput.output += `

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u2705 INITIALIZED
${stateSession.graph.getTaskSummary()}`;
            }
          } catch {
          }
        }
      }
      if (stateSession?.graph) {
        const taskId = stateSession.currentTask;
        if (toolOutput.output.includes("\u2705 PASS") || toolOutput.output.includes("AUDIT RESULT: PASS")) {
          if (taskId) {
            stateSession.graph.updateTask(taskId, { status: "completed" });
            stateSession.taskRetries.clear();
            toolOutput.output += `

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u2705 ${taskId} VERIFIED
${stateSession.graph.getTaskSummary()}`;
          }
        } else if (toolOutput.output.includes("\u274C FAIL") || toolOutput.output.includes("AUDIT RESULT: FAIL")) {
          if (taskId) {
            const retries = (stateSession.taskRetries.get(taskId) || 0) + 1;
            stateSession.taskRetries.set(taskId, retries);
            if (retries >= state.maxRetries) {
              stateSession.graph.updateTask(taskId, { status: "failed" });
              toolOutput.output += `

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u26A0\uFE0F ${taskId} FAILED (${retries}x)`;
            } else {
              toolOutput.output += `

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u{1F504} RETRY ${retries}/${state.maxRetries}`;
            }
          }
        }
        const readyTasks = stateSession.graph.getReadyTasks();
        if (readyTasks.length > 0) {
          toolOutput.output += `
\u{1F449} NEXT: ${readyTasks.map((t) => `[${t.id}]`).join(", ")}`;
        }
      }
      toolOutput.output += `

[${session.step}/${session.maxSteps}]`;
    },
    "assistant.done": async (assistantInput, assistantOutput) => {
      const sessionID = assistantInput.sessionID;
      const session = sessions.get(sessionID);
      if (!session?.active) return;
      const parts = assistantOutput.parts;
      const textContent = parts?.filter((p) => p.type === "text" || p.type === "reasoning").map((p) => p.text || "").join("\n") || "";
      if (textContent.includes("\u2705 MISSION COMPLETE") || textContent.includes("MISSION COMPLETE")) {
        session.active = false;
        state.missionActive = false;
        sessions.delete(sessionID);
        state.sessions.delete(sessionID);
        return;
      }
      if (textContent.includes("/stop") || textContent.includes("/cancel")) {
        session.active = false;
        state.missionActive = false;
        sessions.delete(sessionID);
        state.sessions.delete(sessionID);
        return;
      }
      session.step++;
      session.timestamp = Date.now();
      if (session.step >= session.maxSteps) {
        session.active = false;
        state.missionActive = false;
        return;
      }
      try {
        if (client?.session?.prompt) {
          await client.session.prompt({
            path: { id: sessionID },
            body: {
              parts: [{
                type: "text",
                text: CONTINUE_INSTRUCTION + `

[Step ${session.step}/${session.maxSteps}]`
              }]
            }
          });
        }
      } catch {
        try {
          await new Promise((r) => setTimeout(r, 500));
          if (client?.session?.prompt) {
            await client.session.prompt({
              path: { id: sessionID },
              body: { parts: [{ type: "text", text: "continue" }] }
            });
          }
        } catch {
          session.active = false;
          state.missionActive = false;
        }
      }
    },
    handler: async ({ event }) => {
      if (event.type === "session.deleted") {
        const props = event.properties;
        if (props?.info?.id) {
          sessions.delete(props.info.id);
          state.sessions.delete(props.info.id);
        }
      }
    }
  };
};
var index_default = OrchestratorPlugin;
export {
  index_default as default
};
