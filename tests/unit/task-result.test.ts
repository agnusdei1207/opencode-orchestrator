import { describe, expect, it, vi } from "vitest";
import { extractTaskResultText, fetchTaskResultText } from "../../src/core/agents/manager/task-result";

describe("task-result", () => {
    it("extracts the latest assistant text and reasoning parts", () => {
        const text = extractTaskResultText([
            {
                info: { role: "assistant" },
                parts: [{ type: "text", text: "old" }],
            },
            {
                info: { role: "user" },
                parts: [{ type: "text", text: "ignore" }],
            },
            {
                info: { role: "assistant" },
                parts: [
                    { type: "reasoning", text: "reason" },
                    { type: "text", text: "answer" },
                    { type: "tool", text: "ignore" },
                ],
            },
        ]);

        expect(text).toBe("reason\nanswer");
    });

    it("returns formatted session message errors", async () => {
        const client = {
            session: {
                messages: vi.fn().mockResolvedValue({ error: "messages unavailable" }),
            },
        };

        await expect(fetchTaskResultText(client as never, "session-1"))
            .resolves.toBe("Error: messages unavailable");
    });
});
