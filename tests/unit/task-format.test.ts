import { describe, expect, it } from "vitest";
import {
    buildAgentTaskCompletionMessage,
    buildAgentTaskProgressMessage,
} from "../../src/core/agents/format";
import { TASK_STATUS } from "../../src/shared";

describe("parallel task format helpers", () => {
    it("builds a compact completion notification with task ids and no duplicate tool call syntax", () => {
        const message = buildAgentTaskCompletionMessage([
            { id: "task_a", agent: "Worker", status: TASK_STATUS.COMPLETED },
            { id: "task_b", agent: "Reviewer", status: TASK_STATUS.ERROR },
        ]);

        expect(message).toBe("[BACKGROUND COMPLETE]\nresults=task_a:Worker:done,task_b:Reviewer:error\nnext=get_task_result");
        expect(message).not.toContain("ACTION REQUIRED");
        expect(message).not.toContain("get_task_result(taskId)");
        expect(message).not.toContain("<system-notification>");
        expect(message).not.toContain("Background tasks complete.");
    });

    it("builds a minimal progress notification for agent-to-agent updates", () => {
        const message = buildAgentTaskProgressMessage([{ id: "task_a" }, { id: "task_b" }], 3);

        expect(message).toBe("[BACKGROUND UPDATE] completed=2 pending=3\nids=task_a,task_b");
        expect(message).not.toContain("Continue");
        expect(message).not.toContain("You will be notified");
    });
});
