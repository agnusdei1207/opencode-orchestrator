import { tool } from "@opencode-ai/plugin";
import { AGENT_NAMES } from "../shared/contracts/names.js";

/**
 * Slash commands for OpenCode Orchestrator
 * Simplified: Only /task and /agents are needed
 */
export const COMMANDS: Record<string, { description: string; template: string; argumentHint?: string }> = {
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
Step 2: If complex task, call Architect to create parallel DAG
Step 3: Execute tasks with same parallel_group CONCURRENTLY
Step 4: After EACH task, call Inspector to verify with evidence
Step 5: Update Memory with progress after each verified task
Step 6: REPEAT steps 3-5 until ALL tasks are verified complete
Step 7: Report "MISSION COMPLETE" with summary of evidence
</execution_flow>

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
        argumentHint: '"mission goal"',
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
        argumentHint: '"complex task to plan"',
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
THINK → ACT → OBSERVE → ADJUST → REPEAT
\`\`\`

## Key Behaviors
- Parallel execution: Tasks with same parallel_group run concurrently
- Evidence-based: No task is complete without proof
- Relentless: Never stops until MISSION COMPLETE
- Auto-fix: Inspector repairs problems automatically

## Usage
Select "Commander" agent or use \`/task "goal"\` command.`,
    },
};

export function createSlashcommandTool() {
    const commandList = Object.entries(COMMANDS)
        .map(([name, cmd]) => {
            const hint = cmd.argumentHint ? ` ${cmd.argumentHint}` : "";
            return `- /${name}${hint}: ${cmd.description}`;
        })
        .join("\n");

    return tool({
        description: `Available commands:\n${commandList}`,
        args: {
            command: tool.schema.string().describe("Command name (without slash)"),
        },
        async execute(args) {
            const cmdName = (args.command || "").replace(/^\//, "").split(/\s+/)[0].toLowerCase();
            const cmdArgs = (args.command || "").replace(/^\/?\\S+\s*/, "");

            if (!cmdName) return `Commands:\n${commandList}`;

            const command = COMMANDS[cmdName];
            if (!command) return `Unknown command: /${cmdName}\n\n${commandList}`;

            return command.template.replace(/\$ARGUMENTS/g, cmdArgs || "continue from where we left off");
        },
    });
}
