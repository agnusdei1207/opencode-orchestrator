import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    SessionRegistry,
    DELETE_SETTLE_MS,
    DELETE_RETRY_MS,
    DELETE_MAX_DEFER_MS,
} from "../../src/core/agents/session-registry.js";
import { resetSessionActivity, touchSessionActivity } from "../../src/core/session/activity.js";
import { SessionDeletionUnavailableError } from "../../src/shared/errors/session-deletion-unavailable.js";

function createClient() {
    const statusMap = new Map<string, string>();
    let nextID = 0;
    return {
        setStatus(next: Record<string, string>) {
            statusMap.clear();
            for (const [id, status] of Object.entries(next)) statusMap.set(id, status);
        },
        createSession: vi.fn(async (_input: { parentID?: string; title: string }) => `ses_${++nextID}`),
        removeSession: vi.fn(async (_sessionID: string) => undefined),
        statuses: vi.fn(() => statusMap as ReadonlyMap<string, string>),
    };
}

describe("SessionRegistry deletion guards", () => {
    let client: ReturnType<typeof createClient>;
    let registry: SessionRegistry;

    beforeEach(() => {
        vi.useFakeTimers();
        resetSessionActivity();
        client = createClient();
        registry = new SessionRegistry(client as never);
    });

    afterEach(async () => {
        await registry.shutdown();
        vi.useRealTimers();
        resetSessionActivity();
    });

    it("creates a child session with its parent and task title", async () => {
        const session = await registry.acquire("Worker", "parent-1", "Review changes");
        expect(session.id).toBe("ses_1");
        expect(client.createSession).toHaveBeenCalledWith({
            parentID: "parent-1",
            title: "Parallel: Review changes",
        });
    });

    it("fails acquisition when the host returns no session ID", async () => {
        client.createSession.mockResolvedValueOnce("");
        await expect(registry.acquire("Worker", "parent", "task")).rejects.toThrow("no session ID");
    });

    it("defers an in-use deletion until release and settle", async () => {
        const session = await registry.acquire("worker", "parent", "task");
        await registry.invalidate(session.id);
        expect(client.removeSession).not.toHaveBeenCalled();

        await registry.release(session.id);
        expect(client.removeSession).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(DELETE_SETTLE_MS + 1);
        expect(client.removeSession).toHaveBeenCalledWith(session.id);
        await registry.invalidate(session.id);
        expect(client.removeSession).toHaveBeenCalledTimes(1);
    });

    it("waits for the host to report idle", async () => {
        const session = await registry.acquire("worker", "parent", "task");
        client.setStatus({ [session.id]: "busy" });
        await registry.release(session.id);
        await vi.advanceTimersByTimeAsync(DELETE_SETTLE_MS + DELETE_RETRY_MS);
        expect(client.removeSession).not.toHaveBeenCalled();

        client.setStatus({});
        await vi.advanceTimersByTimeAsync(DELETE_RETRY_MS + DELETE_SETTLE_MS + 1);
        expect(client.removeSession).toHaveBeenCalledWith(session.id);
    });

    it("extends the settle window when host events continue", async () => {
        const session = await registry.acquire("worker", "parent", "task");
        await registry.release(session.id);
        await vi.advanceTimersByTimeAsync(DELETE_SETTLE_MS - 1_000);
        touchSessionActivity(session.id);
        await vi.advanceTimersByTimeAsync(2_000);
        expect(client.removeSession).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(DELETE_SETTLE_MS);
        expect(client.removeSession).toHaveBeenCalledOnce();
    });

    it("never hands a released transcript to another task", async () => {
        const first = await registry.acquire("worker", "parent", "first");
        await registry.release(first.id);
        const second = await registry.acquire("worker", "parent", "second");
        expect(second.id).not.toBe(first.id);
        await vi.advanceTimersByTimeAsync(DELETE_SETTLE_MS + 1);
        expect(client.removeSession).toHaveBeenCalledWith(first.id);
        expect(client.removeSession).not.toHaveBeenCalledWith(second.id);
    });

    it("forgets a session that never becomes idle", async () => {
        const session = await registry.acquire("worker", "parent", "task");
        client.setStatus({ [session.id]: "busy" });
        await registry.release(session.id);
        await vi.advanceTimersByTimeAsync(DELETE_MAX_DEFER_MS + DELETE_RETRY_MS * 2);
        expect(client.removeSession).not.toHaveBeenCalled();
        const checks = client.statuses.mock.calls.length;
        await registry.invalidate(session.id);
        expect(client.statuses).toHaveBeenCalledTimes(checks);
        expect(client.removeSession).not.toHaveBeenCalled();
    });

    it("forgets a session already deleted by the host", async () => {
        const session = await registry.acquire("worker", "parent", "task");
        registry.forget(session.id);
        await registry.release(session.id);
        await registry.invalidate(session.id);
        expect(client.removeSession).not.toHaveBeenCalled();
    });

    it("forgets a session when the plugin API cannot delete it", async () => {
        client.removeSession.mockRejectedValueOnce(new SessionDeletionUnavailableError());
        const session = await registry.acquire("worker", "parent", "task");
        await registry.release(session.id);
        await vi.advanceTimersByTimeAsync(DELETE_SETTLE_MS + 1);
        await registry.invalidate(session.id);
        expect(client.removeSession).toHaveBeenCalledTimes(1);
    });

    it("keeps a session indexed when the host deletion fails", async () => {
        client.removeSession.mockRejectedValueOnce(new Error("permission denied"));
        const session = await registry.acquire("worker", "parent", "task");
        session.inUse = false;
        session.lastUsedAt = new Date(Date.now() - DELETE_SETTLE_MS * 2);
        await registry.invalidate(session.id);
        expect(client.removeSession).toHaveBeenCalledOnce();
        await registry.invalidate(session.id);
        expect(client.removeSession).toHaveBeenCalledTimes(2);
    });

    it("retries a failed host deletion during stale-session cleanup", async () => {
        client.removeSession.mockRejectedValueOnce(new Error("temporary failure"));
        const session = await registry.acquire("worker", "parent", "task");
        session.inUse = false;
        session.lastUsedAt = new Date(Date.now() - 600_000);
        await registry.invalidate(session.id);
        expect(client.removeSession).toHaveBeenCalledOnce();

        expect(await registry.cleanup()).toBe(1);
        expect(client.removeSession).toHaveBeenCalledTimes(2);
        await registry.invalidate(session.id);
        expect(client.removeSession).toHaveBeenCalledTimes(2);
    });

    it("shutdown skips in-use and unsettled sessions", async () => {
        const inUse = await registry.acquire("worker", "parent", "running");
        const fresh = await registry.acquire("worker", "parent", "fresh");
        await registry.release(fresh.id);
        await registry.shutdown();
        expect(client.removeSession).not.toHaveBeenCalledWith(inUse.id);
        expect(client.removeSession).not.toHaveBeenCalledWith(fresh.id);
    });

    it("shutdown deletes a settled idle session", async () => {
        const session = await registry.acquire("worker", "parent", "old");
        session.inUse = false;
        session.lastUsedAt = new Date(Date.now() - DELETE_SETTLE_MS * 2);
        await registry.shutdown();
        expect(client.removeSession).toHaveBeenCalledWith(session.id);
    });
});
