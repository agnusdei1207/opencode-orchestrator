import { tool } from "@opencode-ai/plugin";
import { AGENTS } from "../agents/definitions.js";

export const callAgentTool = tool({
    description: `Call a team member to perform specific work.

## Team
- **planner**: Decompose complex task into atomic units
- **coder**: Implement single atomic task
- **reviewer**: Quality check (ALWAYS after coder)
- **fixer**: Fix specific errors from reviewer
- **searcher**: Find patterns and context

## Self-Correcting Workflow
1. planner → atomic tasks
2. For each task:
   - searcher (if needed)
   - coder
   - reviewer (mandatory)
   - fixer (if errors) → reviewer again
3. Continue until all pass`,
    args: {
        agent: tool.schema
            .enum(["planner", "coder", "reviewer", "fixer", "searcher"])
            .describe("Team member to call"),
        task: tool.schema.string().describe("Atomic task or specific error to address"),
        context: tool.schema.string().optional().describe("Relevant context from previous steps"),
    },
    async execute(args) {
        const agentDef = AGENTS[args.agent];
        if (!agentDef) {
            return `Error: Unknown agent: ${args.agent}`;
        }

        // Extract task ID for tracking if available
        // Note: Actual tracking updates happen in tool.execute.after hook in the main plugin file
        const taskIdMatch = args.task.match(/\[(TASK-\d+)\]/i);
        if (taskIdMatch) {
            // Placeholder for any immediate side effects if needed
        }

        const prompt = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${agentDef.id.toUpperCase()} AGENT
${agentDef.description}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<system>
${agentDef.systemPrompt}
</system>

<task>
${args.task}
</task>

${args.context ? `<context>\n${args.context}\n</context>` : ""}

Execute according to your role. Be thorough and precise.
`;

        return prompt;
    },
});
