import { tool, type ToolDefinition } from "@opencode-ai/plugin";
import { AGENTS } from "../agents/definitions.js";
import { AGENT_NAMES, EXECUTION_CYCLE_STEPS, VERIFICATION_SIGNALS, PROMPT_TAGS, PARALLEL_PARAMS } from "../shared/index.js";

export const callAgentTool: ToolDefinition = tool({
    description: `Call a specialized agent for parallel execution.

${PROMPT_TAGS.AGENTS.open}
| Agent | Role | When to Use |
|-------|------|-------------|
| ${AGENT_NAMES.PLANNER} | Planner + Researcher | Complex task -> plan, OR need research first |
| ${AGENT_NAMES.WORKER} | Developer + Docs | Any code implementation, documentation |
| ${AGENT_NAMES.REVIEWER} | Verifier + Context | Module-level & Final Verification, update TODO |
${PROMPT_TAGS.AGENTS.close}


${PROMPT_TAGS.EXECUTION_RULES.open}
1. Tasks with same ${PARALLEL_PARAMS.PARALLEL_GROUP} run CONCURRENTLY
2. Call Reviewer for module-level verification
3. Call Reviewer for final "${VERIFICATION_SIGNALS.FINAL_PASS}" pass
4. Never stop until mission is 100% complete
${PROMPT_TAGS.EXECUTION_RULES.close}`,
    args: {
        [PARALLEL_PARAMS.AGENT]: tool.schema
            .enum([
                AGENT_NAMES.PLANNER,
                AGENT_NAMES.WORKER,
                AGENT_NAMES.REVIEWER,
            ])
            .describe("Agent to call"),
        [PARALLEL_PARAMS.TASK]: tool.schema.string().describe("Atomic task description"),
        [PARALLEL_PARAMS.CONTEXT]: tool.schema.string().optional().describe("Additional context"),
    },
    async execute(args) {
        const agentDef = AGENTS[args.agent];
        if (!agentDef) {
            return `Error: Unknown agent: ${args.agent}`;
        }

        const label = args.agent[0].toUpperCase();

        const prompt = `
[ ${label} ] ${agentDef.id.toUpperCase()} :: ${agentDef.description}


${PROMPT_TAGS.SYSTEM.open}
${agentDef.systemPrompt}
${PROMPT_TAGS.SYSTEM.close}

${PROMPT_TAGS.TASK.open}
${args[PARALLEL_PARAMS.TASK]}
${PROMPT_TAGS.TASK.close}

${args[PARALLEL_PARAMS.CONTEXT] ? `${PROMPT_TAGS.CONTEXT.open}\n${args[PARALLEL_PARAMS.CONTEXT]}\n${PROMPT_TAGS.CONTEXT.close}` : ""}

${PROMPT_TAGS.EXECUTION.open}
Follow this pattern:
${EXECUTION_CYCLE_STEPS}

Report with evidence of success.
Never claim completion without proof.
${PROMPT_TAGS.EXECUTION.close}
`;

        return prompt;
    },
});
