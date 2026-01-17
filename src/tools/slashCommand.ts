import { tool } from "@opencode-ai/plugin";
import { AGENT_NAMES, PROMPTS, TOOL_NAMES, MISSION, ID_PREFIX } from "../shared/constants.js";

/**
 * Slash commands for OpenCode Orchestrator
 * - /task: Mission mode trigger
 * - /plan: Planning only
 * - /agents: Show architecture
 */

// Simple mission trigger - Commander agent's full prompt is in orchestrator.ts
const TASK_TRIGGER_TEMPLATE = `<mission_mode>
You are now in MISSION MODE. Execute the following task autonomously until complete.

<task>
$ARGUMENTS
</task>

<execution_rules>
1. Complete this mission without user intervention
2. Use your full capabilities: research, implement, verify
3. Output "${MISSION.COMPLETE}" when done
</execution_rules>
</mission_mode>`;

export const COMMANDS: Record<string, { description: string; template: string; argumentHint?: string }> = {
  "task": {
    description: "🚀 MISSION MODE - Execute task autonomously until complete",
    template: TASK_TRIGGER_TEMPLATE,
    argumentHint: '"mission goal"',
  },
  "plan": {
    description: "Create a task plan without executing",
    template: `<delegate>
<agent>${AGENT_NAMES.ARCHITECT}</agent>
<objective>Create parallel task plan for: $ARGUMENTS</objective>
<success>Valid JSON with tasks array, each having id, description, agent, parallel_group, dependencies, and success criteria</success>
<must_do>
- Maximize parallelism by grouping independent tasks
- Assign correct agent to each task (${AGENT_NAMES.BUILDER} or ${AGENT_NAMES.INSPECTOR})
- Include clear success criteria for each task
</must_do>
<must_not>
- Do not implement any tasks, only plan
- Do not create tasks that depend on each other unnecessarily
</must_not>
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
| ${AGENT_NAMES.ARCHITECT} | Planner | Decomposes complex tasks into parallel subtasks |
| ${AGENT_NAMES.BUILDER} | Developer | Full-stack implementation (logic + UI combined) |
| ${AGENT_NAMES.INSPECTOR} | Quality | 5-point audit + automatic bug fixing |
| ${AGENT_NAMES.RECORDER} | Context | Persistent progress tracking across sessions |

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
- Just select Commander agent and type your request
- Or use \`/task "goal"\` for explicit mission mode`,
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

      return command.template.replace(/\$ARGUMENTS/g, cmdArgs || PROMPTS.CONTINUE_DEFAULT);
    },
  });
}
