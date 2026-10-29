import type { Plugin } from "@opencode/plugin";
import { describe, expect, it, vi } from "vitest";
import { createHostClient } from "../../src/host/client.js";
import { SessionDeletionUnavailableError } from "../../src/shared/errors/session-deletion-unavailable.js";

function createHost(messages: unknown[] = []) {
    const session = {
        create: vi.fn().mockResolvedValue({ id: "child-1" }),
        context: vi.fn().mockResolvedValue(messages),
        prompt: vi.fn().mockResolvedValue({}),
        synthetic: vi.fn().mockResolvedValue({}),
        switchAgent: vi.fn().mockResolvedValue(undefined),
        interrupt: vi.fn().mockResolvedValue({ interrupted: true }),
    };
    const model = { list: vi.fn().mockResolvedValue({ data: [] }) };
    const location = { directory: "/tmp/v2-client-project", project: { directory: "/tmp/v2-client-project" } };
    return { context: { session, location, model } as unknown as Plugin.Context, session, model };
}

describe("OpenCode 2 host client", () => {
    it("preserves the parent when creating a delegated session", async () => {
        const { context, session } = createHost();

        const id = await createHostClient(context).client.createSession({ parentID: "parent-1", title: "Delegated child" });

        expect(session.create).toHaveBeenCalledExactlyOnceWith({ parentID: "parent-1", title: "Delegated child" });
        expect(id).toBe("child-1");
    });

    it("can still create a root session without a parent", async () => {
        const { context, session } = createHost();

        await createHostClient(context).client.createSession({ title: "Root" });

        expect(session.create).toHaveBeenCalledExactlyOnceWith({ parentID: undefined, title: "Root" });
    });

    it("maps assistant messages including finish, timing, text and tool calls", async () => {
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
                    { type: "tool", name: "bash" },
                    { type: "tool", name: "read" },
                ],
            },
            "not-a-message",
        ]);

        const messages = await createHostClient(context).client.messages("session-1");

        expect(session.context).toHaveBeenCalledWith({ sessionID: "session-1" });
        expect(messages).toEqual([
            {
                id: "user-1", role: "user", created: 50, completed: undefined,
                error: undefined, finish: undefined, text: "please", toolCallCount: 0,
            },
            {
                id: "message-1", role: "assistant", created: 100, completed: 200,
                error: undefined, finish: "stop", text: "thinking\ndone", toolCallCount: 2,
            },
        ]);
    });

    it("returns the interrupt confirmation", async () => {
        const { context, session } = createHost();

        await expect(createHostClient(context).client.interrupt("session-1")).resolves.toBe(true);
        expect(session.interrupt).toHaveBeenCalledWith({ sessionID: "session-1", resume: false });

        session.interrupt.mockResolvedValueOnce({ interrupted: false });
        await expect(createHostClient(context).client.interrupt("session-1")).resolves.toBe(false);
    });

    it("keeps intermediate synthetic notices silent", async () => {
        const { context, session } = createHost();

        await createHostClient(context).client.prompt({ sessionID: "session-1", text: "task done", synthetic: true, reply: false });

        expect(session.synthetic).toHaveBeenCalledWith({ sessionID: "session-1", text: "task done", resume: false });
        expect(session.prompt).not.toHaveBeenCalled();
    });

    it("resumes by default after a synthetic notice", async () => {
        const { context, session } = createHost();

        await createHostClient(context).client.prompt({ sessionID: "session-1", text: "continue", synthetic: true });

        expect(session.synthetic).toHaveBeenCalledWith({ sessionID: "session-1", text: "continue", resume: true });
    });

    it("selects the requested host agent before prompting a child session", async () => {
        const { context, session } = createHost();

        await createHostClient(context).client.prompt({ sessionID: "session-1", agent: "Worker", text: "do work" });

        expect(session.switchAgent).toHaveBeenCalledWith({ sessionID: "session-1", agent: "Worker" });
        expect(session.prompt).toHaveBeenCalledWith({ sessionID: "session-1", text: "do work", resume: true });
        expect(session.switchAgent.mock.invocationCallOrder[0]).toBeLessThan(session.prompt.mock.invocationCallOrder[0]);
        expect(session.synthetic).not.toHaveBeenCalled();
    });

    it("propagates host API failures instead of returning error objects", async () => {
        const { context, session } = createHost();
        session.prompt.mockRejectedValueOnce(new Error("host down"));

        await expect(createHostClient(context).client.prompt({ sessionID: "session-1", text: "x" }))
            .rejects.toThrow("host down");
    });

    it("does not report session interruption as deletion on hosts without session.remove", async () => {
        const { context, session } = createHost();

        await expect(createHostClient(context).client.removeSession("session-1"))
            .rejects.toBeInstanceOf(SessionDeletionUnavailableError);
        expect(session.interrupt).not.toHaveBeenCalled();
    });

    it("deletes the session through session.remove when the host provides it", async () => {
        const { context, session } = createHost();
        const remove = vi.fn().mockResolvedValue(undefined);
        Object.assign(session, { remove });

        await expect(createHostClient(context).client.removeSession("session-1")).resolves.toBeUndefined();

        expect(remove).toHaveBeenCalledExactlyOnceWith({ sessionID: "session-1" });
        expect(session.interrupt).not.toHaveBeenCalled();
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
