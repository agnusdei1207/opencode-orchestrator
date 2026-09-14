import { tool, type ToolDefinition } from "@opencode-ai/plugin";
import { AGENT_NAMES, PROMPTS } from "../shared/index.js";

export const MISSION_MODE_TEMPLATE = `<mission>
<task>
$ARGUMENTS
</task>

<execution_rules>
1. Resolve the objective and constraints, then continue authorized work. Respect user pause, abort, and changed instructions.
2. Handle small work directly. Delegate only useful independent scopes; resolve planning dependencies before implementation.
3. Verify results before completion. In an active TODO hierarchy, verified leaves use [x] and verified parents use status: completed. If a verification checklist exists, every item must pass. Report blockers and unperformed checks honestly.
</execution_rules>
</mission>`;

export const COMMANDS: Record<string, { description: string; template: string; argumentHint?: string }> = {
  "task": {
    description: "MISSION MODE - Execute task autonomously until complete",
    template: MISSION_MODE_TEMPLATE,
    argumentHint: '"mission goal"',
  },
  "plan": {
    description: "Create a task plan without executing",
    template: `<delegate>
<objective>Prepare a proportional plan for: $ARGUMENTS</objective>
Inspect relevant evidence, identify dependencies and material uncertainty, and state acceptance checks. Do not implement the plan. Use ${AGENT_NAMES.PLANNER} only if separate research is useful. Return the plan in the response; update mission files only when requested or already part of the assigned mission. If using the existing TODO hierarchy, preserve its M/T/S schema and leave unverified items pending.
</delegate>`,
    argumentHint: '"complex task to plan"',
  },
  "agents": {
    description: "Show the 4-agent architecture",
    template: `## OpenCode Orchestrator - 4-Agent Architecture

| Agent | Role | Capabilities |
|-------|------|--------------|
| **${AGENT_NAMES.COMMANDER}** | [COORDINATOR] | Owns the goal, implements directly, verifies, and delegates when useful |
| **${AGENT_NAMES.PLANNER}** | [STRATEGIST] | Planning, research, documentation analysis |
| **${AGENT_NAMES.WORKER}** | [EXECUTOR] | Implementation, coding, terminal tasks |
| **${AGENT_NAMES.REVIEWER}** | [VERIFIER] | Verification, testing, context sanity checks |

These are optional presets. Distinguish questions, reviews, planning, and implementation first. Handle small work directly. Planning precedes dependent implementation; only independent scopes may run in parallel. An independent review is optional. Concurrency settings are limits, not a target team size. OpenCode owns native tools, permissions, sessions, and compaction.

## Usage
- Select **${AGENT_NAMES.COMMANDER}** and type your request
- Or use \`/task "your mission"\` explicitly
- ${AGENT_NAMES.COMMANDER} chooses only the roles needed for the request`,
  },
};

export function createSlashcommandTool(): ToolDefinition {
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
      const cmdArgs = (args.command || "").replace(/^\/?\S+\s*/, "");

      if (!cmdName) return `Commands:\n${commandList}`;

      const command = COMMANDS[cmdName];
      if (!command) return `Unknown command: /${cmdName}\n\n${commandList}`;

      return command.template.replace(/\$ARGUMENTS/g, cmdArgs || PROMPTS.CONTINUE_DEFAULT);
    },
  });
}
