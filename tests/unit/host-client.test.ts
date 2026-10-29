import type { Plugin } from "@opencode/plugin";
import { describe, expect, it, vi } from "vitest";
import { createHostClient } from "../../src/host/client.js";

function createHost(messages: unknown[] = []) {
    const session = {
        context: vi.fn().mockResolvedValue(messages),
        prompt: vi.fn().mockResolvedValue({}),
        synthetic: vi.fn().mockResolvedValue({}),
        interrupt: vi.fn().mockResolvedValue({ interrupted: true }),
    };
    const model = { list: vi.fn().mockResolvedValue({ data: [] }) };
    const location = { directory: "/tmp/v2-client-project", project: { directory: "/tmp/v2-client-project" } };
    return { context: { session, location, model } as unknown as Plugin.Context, session, model };
}

describe("OpenCode 2 host client", () => {
    it("maps messages to their id, text and tool-call count", async () => {
        const { context, session } = createHost([
            { id: "user-1", type: "user", text: "please", time: { created: 50 } },
            {
                id: "message-1",
                type: "assistant",
                finish: "stop",
                time: { created: 100, completed: 200 },
                content: [
                    { type: "reasoning", text: "thinking" },
                    { type: "text", text: "done" },
                    { type: "tool", name: "shell" },
                    { type: "tool", name: "read" },
                ],
            },
            "not-a-message",
        ]);

        const messages = await createHostClient(context).client.messages("session-1");

        expect(session.context).toHaveBeenCalledWith({ sessionID: "session-1" });
        expect(messages).toEqual([
            { id: "user-1", text: "please", toolCallCount: 0 },
            { id: "message-1", text: "thinking\ndone", toolCallCount: 2 },
        ]);
    });

    it("returns the interrupt confirmation", async () => {
        const { context, session } = createHost();

        await expect(createHostClient(context).client.interrupt("session-1")).resolves.toBe(true);
        expect(session.interrupt).toHaveBeenCalledWith({ sessionID: "session-1", resume: false });

        session.interrupt.mockResolvedValueOnce({ interrupted: false });
        await expect(createHostClient(context).client.interrupt("session-1")).resolves.toBe(false);
    });

    // Issue #37: a plain prompt renders in the TUI as if the user typed it.
    it("sends every prompt as a synthetic message that starts a turn", async () => {
        const { context, session } = createHost();

        await createHostClient(context).client.prompt({ sessionID: "session-1", text: "continue" });

        expect(session.synthetic).toHaveBeenCalledExactlyOnceWith({ sessionID: "session-1", text: "continue", resume: true });
        expect(session.prompt).not.toHaveBeenCalled();
    });

    it("propagates host API failures instead of returning error objects", async () => {
        const { context, session } = createHost();
        session.synthetic.mockRejectedValueOnce(new Error("host down"));

        await expect(createHostClient(context).client.prompt({ sessionID: "session-1", text: "x" }))
            .rejects.toThrow("host down");
    });

    it("exposes the bridge-owned statuses map through the client", () => {
        const { context } = createHost();
        const bridge = createHostClient(context);

        expect(bridge.client.statuses().size).toBe(0);
        bridge.statuses.set("session-1", "busy");
        expect(bridge.client.statuses().get("session-1")).toBe("busy");
    });

    it("looks up the configured context window for a model in the project location", async () => {
        const { context, model } = createHost();
        model.list.mockResolvedValue({ data: [
            { providerID: "anthropic", id: "other", limit: { context: 1 } },
            { providerID: "anthropic", id: "claude", limit: { context: 500_000 } },
        ] });
        const { client } = createHostClient(context);

        await expect(client.modelContextLimit("anthropic", "claude")).resolves.toBe(500_000);
        await expect(client.modelContextLimit("anthropic", "missing")).resolves.toBeUndefined();
        expect(model.list).toHaveBeenCalledWith({ location: { directory: "/tmp/v2-client-project" } });
    });
});
