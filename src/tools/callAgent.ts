import { tool } from "@opencode-ai/plugin";
import { AGENTS } from "../agents/definitions.js";
import { AGENT_NAMES, EXECUTION_CYCLE_STEPS } from "../shared/index.js";

export const callAgentTool = tool({
    description: `Call a specialized agent for parallel execution.

<agents>
| Agent | Role | When to Use |
|-------|------|-------------|
| ${AGENT_NAMES.PLANNER} | Planner + Researcher | Complex task -> plan, OR need research first |
| ${AGENT_NAMES.WORKER} | Developer + Docs | Any code implementation, documentation |
| ${AGENT_NAMES.REVIEWER} | Verifier + Context | Before completion, verify, update TODO |
</agents>


<execution_rules>
1. Tasks with same parallel_group run CONCURRENTLY
2. Always call Reviewer before marking complete
3. Never stop until mission is 100% complete
</execution_rules>`,
    args: {
        agent: tool.schema
            .enum([
                AGENT_NAMES.PLANNER,
                AGENT_NAMES.WORKER,
                AGENT_NAMES.REVIEWER,
            ])
            .describe("Agent to call"),
        task: tool.schema.string().describe("Atomic task description"),
        context: tool.schema.string().optional().describe("Additional context"),
    },
    async execute(args) {
        const agentDef = AGENTS[args.agent];
        if (!agentDef) {
            return `Error: Unknown agent: ${args.agent}`;
        }

        const label = args.agent[0].toUpperCase();

        const prompt = `
[ ${label} ] ${agentDef.id.toUpperCase()} :: ${agentDef.description}


<system>
${agentDef.systemPrompt}
</system>

<task>
${args.task}
</task>

${args.context ? `<context>\n${args.context}\n</context>` : ""}

<execution>
Follow this pattern:
${EXECUTION_CYCLE_STEPS}

Report with evidence of success.
Never claim completion without proof.
</execution>
`;

        return prompt;
    },
});
