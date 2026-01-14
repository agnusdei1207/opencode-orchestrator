import { tool } from "@opencode-ai/plugin";

export const COMMANDS: Record<string, { description: string; template: string; argumentHint?: string }> = {
    "task": {
        description: "Execute a mission using Distributed Cognitive Architecture (PDCA Cycle)",
        template: `🚀 MISSION: DISTRIBUTED TASK EXECUTION (PDCA Methodology)
<command-instruction>
You are the **Kernel** of this operation. You employ **Dynamic Programming** and **Divide & Conquer**.

## Phase 0: Cost/Benefit & Complexity Analysis
- **Assess**: Is this a quick "hotfix" (Linear) or a "System Overhaul" (Distributed Task)?
- **Allocating Strategy**: If complex, activate the **Swarm**.

## Phase 1: Deep Analysis & State Initialization (Plan)
- BEFORE planning, call **searcher** to read all .md docs.
- Create a temporary \`.opencode_mission.md\` as your **Shared Memory Segment**.
- **State Strategy**: Define how independent nodes will share data (e.g., File I/O, config files).

## Phase 1.5: Sync Contract Deal (Interface Agreement)
- **CRITICAL**: If parallel tasks interact (e.g., A calls B), you MUST define the **Interface Contract** first.
- Create \`_interface_contract.md\` containing:
  - Exact Function Signatures & Types.
  - API Routes & Parameter Structures.
  - File Paths for shared data.
- All Agents MUST read this contract before writing code.

## Phase 2: Hierarchical Planning (Do - Step 1)
- Call **planner** to Map the mission into atomic tasks ($O(1)$ complexity).
- **Divide & Conquer**: Break down the problem recursively.
- **Resource Binding**: Bind specific agents/tools to tasks.

## Phase 3: Parallel Execution & Verification (Do - Step 2 & Check)
- Execute READY tasks in parallel. Each agent acts as an independent Actor.
- **PDCA Cycle**: Plan -> Do (Code) -> Check (Review) -> Act (Fix/Merge).
- Route implementation to the **reviewer** (Byzantine Fault Tolerance check).

## Phase 4: Global Sync Gate (Act)
- Once all tasks are ✅ Completed, call **reviewer** for a **Global Consistency Check**.
- verify imports, exports, and cross-file logic patterns.
- DELETE \`.opencode_mission.md\` after final SUCCESS.

## Goal
Achieve **Architectural Superiority**. Complete "$ARGUMENTS" with ZERO regressions.
We do NOT stop for time. We stop when it is DONE.
</command-instruction>

<user-task>
$ARGUMENTS
</user-task>`,
        argumentHint: '"mission goal"',
    },
    "plan": {
        description: "Decompose task into atomic units",
        template: `<agent-prompt agent="planner">
Decompose into atomic tasks:
$ARGUMENTS
</agent-prompt>`,
        argumentHint: '"complex task"',
    },
    "review": {
        description: "Quality check with error detection",
        template: `<agent-prompt agent="reviewer">
Review for ALL issues:
$ARGUMENTS
</agent-prompt>`,
        argumentHint: '"code to review"',
    },
    "fix": {
        description: "Fix specific errors",
        template: `<agent-prompt agent="fixer">
Fix these errors:
$ARGUMENTS
</agent-prompt>`,
        argumentHint: '"error details"',
    },
    "search": {
        description: "Find patterns and context",
        template: `<agent-prompt agent="searcher">
Find patterns for:
$ARGUMENTS
</agent-prompt>`,
        argumentHint: '"what to find"',
    },
    "agents": {
        description: "Show agent team",
        template: `## 6-Agent Collaborative Architecture

| Agent | Role |
|-------|------|
| planner | Decompose into atomic tasks |
| coder | Implement single task |
| reviewer | Quality gate (mandatory) |
| fixer | Apply specific fixes |
| searcher | Find context |

## Self-Correcting Loop
\`\`\`
plan → (search → code → review → fix?) → repeat
\`\`\``,
    },
    "cancel-auto": {
        description: "Stop auto mode",
        template: `Auto mode stopped.`,
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
        description: `Commands\n\n${commandList}`,
        args: {
            command: tool.schema.string().describe("Command (without slash)"),
        },
        async execute(args) {
            const cmdName = (args.command || "").replace(/^\//, "").split(/\s+/)[0].toLowerCase();
            const cmdArgs = (args.command || "").replace(/^\/?\\S+\s*/, "");

            if (!cmdName) return `Commands:\n${commandList}`;

            const command = COMMANDS[cmdName];
            if (!command) return `Unknown: /${cmdName}\n\n${commandList}`;

            return command.template.replace(/\$ARGUMENTS/g, cmdArgs || "continue");
        },
    });
}
