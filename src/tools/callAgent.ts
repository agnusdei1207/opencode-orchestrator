import { tool } from "@opencode-ai/plugin";
import { AGENTS } from "../agents/definitions.js";
import { AGENT_NAMES } from "../shared/contracts/names.js";
import { contextEnforcer } from "../context/enforcer.js";

// Agent emoji indicators
const AGENT_EMOJI: Record<string, string> = {
    [AGENT_NAMES.ARCHITECT]: "🏗️",
    [AGENT_NAMES.BUILDER]: "🔨",
    [AGENT_NAMES.INSPECTOR]: "🔍",
    [AGENT_NAMES.RECORDER]: "💾",
    [AGENT_NAMES.FRONTEND_DESIGNER]: "🎨",
};

export const callAgentTool = tool({
    description: `Call a specialized agent for parallel execution.

<agents>
| Agent | Role | When to Use |
|-------|------|-------------|
| ${AGENT_NAMES.ARCHITECT} 🏗️ | Planner | Complex task → DAG, OR 3+ failures → strategy |
| ${AGENT_NAMES.BUILDER} 🔨 | Developer | Any code implementation (logic + UI) |
| ${AGENT_NAMES.INSPECTOR} 🔍 | Quality | Before completion, OR on errors (auto-fixes) |
| ${AGENT_NAMES.RECORDER} 💾 | Context | After each task, OR at session start |
</agents>

<execution_rules>
1. Tasks with same parallel_group run CONCURRENTLY
2. Always call Inspector before marking complete
3. Always call Recorder after each task
4. Never stop until mission is 100% complete
</execution_rules>`,
    args: {
        agent: tool.schema
            .enum([
                AGENT_NAMES.ARCHITECT,
                AGENT_NAMES.BUILDER,
                AGENT_NAMES.INSPECTOR,
                AGENT_NAMES.RECORDER,
                AGENT_NAMES.FRONTEND_DESIGNER,
            ])
            .describe("Agent to call"),
        task: tool.schema.string().describe("Atomic task description"),
        context: tool.schema.string().optional().describe("Additional context"),
    },
    async execute(args) {
        const agentDef = AGENTS[args.agent];
        if (!agentDef) {
            return "Error: Unknown agent: " + args.agent;
        }

        const emoji = AGENT_EMOJI[args.agent] || "🤖";

        // Validate context before proceeding
        if (args.context) {
            const validation = contextEnforcer.validate(args.agent, args.context);
            if (!validation.valid) {
                return "Context Validation Failed:\n" + contextEnforcer.formatValidation(validation);
            }
        }

        const prompt = `
 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${emoji} ${agentDef.id.toUpperCase()} :: ${agentDef.description}
 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<system>
${agentDef.systemPrompt}
</system>

<task>
${args.task}
</task>

${args.context ? "<context>\n" + args.context + "\n</context>" : ""}

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
    },
});
