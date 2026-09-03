import { describe, it, expect } from "vitest";
import { callAgentTool } from "../../src/tools/callAgent.js";
import { AGENT_NAMES, PARALLEL_PARAMS, PROMPT_TAGS } from "../../src/shared/index.js";

describe("callAgent Tool", () => {
    it("returns prompt template for valid agent with task and context", async () => {
        const result = await (callAgentTool as any).execute({
            [PARALLEL_PARAMS.AGENT]: AGENT_NAMES.PLANNER,
            [PARALLEL_PARAMS.TASK]: "Design user authentication flow",
            [PARALLEL_PARAMS.CONTEXT]: "Use OAuth2 with refresh tokens",
        });

        expect(result).toContain("[ P ] PLANNER ::");
        expect(result).toContain(PROMPT_TAGS.SYSTEM.open);
        expect(result).toContain("Design user authentication flow");
        expect(result).toContain("Use OAuth2 with refresh tokens");
        expect(result).toContain("Report with evidence of success");
    });

    it("works without context parameter", async () => {
        const result = await (callAgentTool as any).execute({
            [PARALLEL_PARAMS.AGENT]: AGENT_NAMES.WORKER,
            [PARALLEL_PARAMS.TASK]: "Implement login route",
        });

        expect(result).toContain("[ W ] WORKER ::");
        expect(result).toContain("Implement login route");
        expect(result).not.toContain(PROMPT_TAGS.CONTEXT.open);
    });

    it("returns error for unknown agent", async () => {
        const result = await (callAgentTool as any).execute({
            agent: "nonexistent_agent",
            task: "Do something",
        });

        expect(result).toContain("Error: Unknown agent: nonexistent_agent");
    });
});
