import { describe, expect, it, vi } from "vitest";
import { fetchTaskResultText } from "../../src/core/agents/manager/task-result";
import type { HostMessage } from "../../src/host/client";

function message(overrides: Partial<HostMessage>): HostMessage {
    return { id: "m", role: "assistant", text: "", toolCallCount: 0, ...overrides };
}

describe("task-result", () => {
    it("returns the latest assistant text", async () => {
        const client = {
            messages: vi.fn().mockResolvedValue([
                message({ id: "1", text: "old" }),
                message({ id: "2", role: "user", text: "ignore" }),
                message({ id: "3", text: "reason\nanswer" }),
                message({ id: "4", role: "user", text: "ignore too" }),
            ]),
        };

        await expect(fetchTaskResultText(client as never, "session-1")).resolves.toBe("reason\nanswer");
        expect(client.messages).toHaveBeenCalledWith("session-1");
    });

    it("reports no response when the session has no assistant message", async () => {
        const client = { messages: vi.fn().mockResolvedValue([message({ role: "user", text: "hi" })]) };

        await expect(fetchTaskResultText(client as never, "session-1")).resolves.toBe("(No response)");
    });

    it("rejects session message errors instead of returning successful result text", async () => {
        const client = { messages: vi.fn().mockRejectedValue(new Error("messages unavailable")) };

        await expect(fetchTaskResultText(client as never, "session-1"))
            .rejects.toThrow("messages unavailable");
    });

    it("rejects an assistant message that ended in an error", async () => {
        const client = {
            messages: vi.fn().mockResolvedValue([message({ text: "partial", error: { message: "model failed" } })]),
        };

        await expect(fetchTaskResultText(client as never, "session-1")).rejects.toThrow("model failed");
    });

    it("ignores replies from before the current run and requires a completed reply", async () => {
        const startedAt = new Date(10_000);
        const client = {
            messages: vi.fn().mockResolvedValue([
                message({ id: "old", text: "previous run", created: 5_000, completed: 6_000 }),
                message({ id: "new", text: "in progress", created: 11_000 }),
            ]),
        };

        await expect(fetchTaskResultText(client as never, "session-1", startedAt))
            .rejects.toThrow("Current task result is not available");

        client.messages.mockResolvedValue([
            message({ id: "old", text: "previous run", created: 5_000, completed: 6_000 }),
            message({ id: "new", text: "current answer", created: 11_000, completed: 12_000 }),
        ]);
        await expect(fetchTaskResultText(client as never, "session-1", startedAt)).resolves.toBe("current answer");
    });
});
