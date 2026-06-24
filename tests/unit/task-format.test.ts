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

        expect(message).toContain("Background tasks complete.");
        expect(message).toContain("- task_a | Worker | done");
        expect(message).toContain("- task_b | Reviewer | error");
        expect(message).toContain("Next: call get_task_result with the task id(s) you need.");
        expect(message).not.toContain("ACTION REQUIRED");
        expect(message).not.toContain("get_task_result(taskId)");
    });

    it("builds a minimal progress notification for agent-to-agent updates", () => {
        const message = buildAgentTaskProgressMessage([{ id: "task_a" }, { id: "task_b" }], 3);

        expect(message).toBe("[BACKGROUND UPDATE] completed=2 pending=3\nids=task_a,task_b");
        expect(message).not.toContain("Continue");
        expect(message).not.toContain("You will be notified");
    });
});
