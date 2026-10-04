import type { Plugin } from "@opencode/plugin";
import { describe, expect, it, vi } from "vitest";
import { createV2ClientBridge } from "../../src/v2/client-adapter.js";

function createHost(messages: unknown[] = []) {
    const session = {
        create: vi.fn().mockResolvedValue({ id: "child-1" }),
        context: vi.fn().mockResolvedValue(messages),
        prompt: vi.fn().mockResolvedValue({}),
        synthetic: vi.fn().mockResolvedValue({}),
        switchAgent: vi.fn().mockResolvedValue(undefined),
        interrupt: vi.fn().mockResolvedValue({ interrupted: true }),
    };
    return { context: { session } as unknown as Plugin.Context, session };
}

describe("OpenCode 2 client bridge", () => {
    it("preserves the parent when creating a delegated session", async () => {
        const { context, session } = createHost();

        const result = await createV2ClientBridge(context).client.session.create({
            body: { parentID: "parent-1", title: "Delegated child" },
        });

        expect(session.create).toHaveBeenCalledExactlyOnceWith({
            parentID: "parent-1", title: "Delegated child",
        });
        expect(result.data?.id).toBe("child-1");
    });

    it("can still create a root session without a parent", async () => {
        const { context, session } = createHost();

        await createV2ClientBridge(context).client.session.create({ body: { title: "Root" } });

        expect(session.create).toHaveBeenCalledExactlyOnceWith({ parentID: undefined, title: "Root" });
    });

    it("preserves assistant finish when listing task messages", async () => {
        const { context } = createHost([{
            id: "message-1",
            type: "assistant",
            finish: "stop",
            time: { created: 100, completed: 200 },
            content: [{ type: "text", text: "done" }],
        }]);

        const result = await createV2ClientBridge(context).client.session.messages({ path: { id: "session-1" } });

        expect(result.data?.[0]?.info).toMatchObject({
            role: "assistant",
            finish: "stop",
            time: { created: 100, completed: 200 },
        });
    });

    it("returns the interrupt result as the legacy abort boolean", async () => {
        const { context, session } = createHost();

        const result = await createV2ClientBridge(context).client.session.abort({ path: { id: "session-1" } });

        expect(result.data).toBe(true);
        expect(session.interrupt).toHaveBeenCalledWith({ sessionID: "session-1", resume: false });
    });

    it("keeps intermediate synthetic notices silent", async () => {
        const { context, session } = createHost();

        await createV2ClientBridge(context).client.session.prompt({
            path: { id: "session-1" },
            body: { noReply: true, parts: [{ type: "text", text: "task done", synthetic: true }] },
        });

        expect(session.synthetic).toHaveBeenCalledWith({ sessionID: "session-1", text: "task done", resume: false });
        expect(session.prompt).not.toHaveBeenCalled();
    });

    it("selects the requested host agent before prompting a child session", async () => {
        const { context, session } = createHost();

        await createV2ClientBridge(context).client.session.prompt({
            path: { id: "session-1" },
            body: { agent: "Worker", parts: [{ type: "text", text: "do work" }] },
        });

        expect(session.switchAgent).toHaveBeenCalledWith({ sessionID: "session-1", agent: "Worker" });
        expect(session.prompt).toHaveBeenCalledWith(expect.objectContaining({ sessionID: "session-1", resume: true }));
    });

    it("does not report session interruption as deletion on hosts without session.remove", async () => {
        const { context, session } = createHost();

        await expect(createV2ClientBridge(context).client.session.delete({ path: { id: "session-1" } }))
            .rejects.toThrow("session deletion is unavailable");
        expect(session.interrupt).not.toHaveBeenCalled();
    });

    it("deletes the session through session.remove when the host provides it", async () => {
        const { context, session } = createHost();
        const remove = vi.fn().mockResolvedValue(undefined);
        Object.assign(session, { remove });

        const result = await createV2ClientBridge(context).client.session.delete({ path: { id: "session-1" } });

        expect(remove).toHaveBeenCalledExactlyOnceWith({ sessionID: "session-1" });
        expect(result.data).toBe(true);
        expect(session.interrupt).not.toHaveBeenCalled();
    });
});
