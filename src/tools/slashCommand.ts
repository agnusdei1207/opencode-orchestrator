import { tool } from "@opencode-ai/plugin";
import { AGENT_NAMES } from "../shared/agent.js";

/**
 * Slash commands for OpenCode Orchestrator
 * Simplified: Only /task and /agents are needed
 */
export const COMMANDS: Record<string, { description: string; template: string; argumentHint?: string }> = {
    "task": {
        description: "Execute a mission autonomously until complete",
        template: `<role>
You are Commander. Complete this mission. Never stop until 100% done.
</role>

<constraints>
Reasoning MUST be in English for model stability. Final report in Korean.
</constraints>

<phase_1 name="MANDATORY_ENVIRONMENT_SCAN">
Before any planning or coding, you MUST understand:
1. INFRA: OS-native? Container? Docker-compose? Volume-mounted?
2. DOMAIN: Web/App/Service/Lib? Monorepo? SSR?
3. STACK: Langs, Frameworks, DBs, Auth method (Bearer vs Cookie).
4. DOCS: Read README.md and /docs/*.md.
5. RECORD: Save findings to Recorder (environment.md).
</phase_1>

<phase_2 name="PLAN">
- Call architect with Environment Context.
- Plan must respect the Infra (e.g. build location).
</phase_2>

<phase_3 name="EXECUTE">
- Use builder with environment constraints.
- Match existing patterns exactly.
</phase_3>

<phase_4 name="VERIFY">
- Node.js: npm run build
- Rust: cargo build
- Docker: syntax check + lsp_diagnostics
- Python: pytest
</phase_4>

<phase_5 name="COMPLETE">
When code works, lsp clean, and build passes.
</phase_5>

<agents>
| Agent | Role |
|-------|------|
| ${AGENT_NAMES.ARCHITECT} | Plan with env context |
| ${AGENT_NAMES.BUILDER} | Code within env limits |
| ${AGENT_NAMES.INSPECTOR} | Verify (always before done) |
| ${AGENT_NAMES.RECORDER} | Save Environment & Progress |
</agents>

<empty_response_rule>
Never stop. Try another way.
</empty_response_rule>

<mission>
$ARGUMENTS
</mission>`,
        argumentHint: '"mission goal"',
    },
    "plan": {
        description: "Create a parallel task DAG without executing",
        template: `<delegate>
<agent>${AGENT_NAMES.ARCHITECT}</agent>
<objective>Create parallel task DAG for: $ARGUMENTS</objective>
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
| ${AGENT_NAMES.ARCHITECT} | Planner | Decomposes complex tasks into parallel DAG |
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
