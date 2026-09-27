import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    SessionRegistry,
    DELETE_SETTLE_MS,
    DELETE_RETRY_MS,
    DELETE_MAX_DEFER_MS,
} from "../../src/core/agents/session-registry.js";
import { resetSessionActivity, touchSessionActivity } from "../../src/core/session/activity.js";
import { SessionDeletionUnavailableError } from "../../src/shared/errors/session-deletion-unavailable.js";

type StatusMap = Record<string, { type: string }>;

function createClient(initialStatus: StatusMap = {}) {
    let statuses = initialStatus;
    let nextID = 0;
    return {
        setStatus(next: StatusMap) { statuses = next; },
        session: {
            create: vi.fn().mockImplementation(async () => ({ data: { id: `ses_${++nextID}` } })),
            delete: vi.fn().mockResolvedValue({ data: true }),
            status: vi.fn().mockImplementation(async () => ({ data: statuses })),
        },
    };
}

describe("SessionRegistry deletion guards", () => {
    let client: ReturnType<typeof createClient>;
    let registry: SessionRegistry;

    beforeEach(() => {
        vi.useFakeTimers();
        resetSessionActivity();
        client = createClient();
        // @ts-expect-error reset the singleton between tests
        SessionRegistry._instance = null;
        registry = SessionRegistry.getInstance(client as never, "/tmp/test-registry");
    });

    afterEach(() => {
        vi.useRealTimers();
        resetSessionActivity();
    });

    it("creates a child session with its parent and task title", async () => {
        const session = await registry.acquire("Worker", "parent-1", "Review changes");
        expect(session.id).toBe("ses_1");
        expect(client.session.create).toHaveBeenCalledWith({
            body: { parentID: "parent-1", title: "Parallel: Review changes" },
            query: { directory: "/tmp/test-registry" },
        });
    });

    it("defers an in-use deletion until release and settle", async () => {
        const session = await registry.acquire("worker", "parent", "task");
        await registry.invalidate(session.id);
        expect(client.session.delete).not.toHaveBeenCalled();

        await registry.release(session.id);
        expect(client.session.delete).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(DELETE_SETTLE_MS + 1);
        expect(client.session.delete).toHaveBeenCalledWith({ path: { id: session.id } });
        await registry.invalidate(session.id);
        expect(client.session.delete).toHaveBeenCalledTimes(1);
    });

    it("waits for the host to report idle", async () => {
        const session = await registry.acquire("worker", "parent", "task");
        client.setStatus({ [session.id]: { type: "busy" } });
        await registry.release(session.id);
        await vi.advanceTimersByTimeAsync(DELETE_SETTLE_MS + DELETE_RETRY_MS);
        expect(client.session.delete).not.toHaveBeenCalled();

        client.setStatus({});
        await vi.advanceTimersByTimeAsync(DELETE_RETRY_MS + DELETE_SETTLE_MS + 1);
        expect(client.session.delete).toHaveBeenCalledWith({ path: { id: session.id } });
    });

    it("extends the settle window when host events continue", async () => {
        const session = await registry.acquire("worker", "parent", "task");
        await registry.release(session.id);
        await vi.advanceTimersByTimeAsync(DELETE_SETTLE_MS - 1_000);
        touchSessionActivity(session.id);
        await vi.advanceTimersByTimeAsync(2_000);
        expect(client.session.delete).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(DELETE_SETTLE_MS);
        expect(client.session.delete).toHaveBeenCalledOnce();
    });

    it("never hands a released transcript to another task", async () => {
        const first = await registry.acquire("worker", "parent", "first");
        await registry.release(first.id);
        const second = await registry.acquire("worker", "parent", "second");
        expect(second.id).not.toBe(first.id);
        await vi.advanceTimersByTimeAsync(DELETE_SETTLE_MS + 1);
        expect(client.session.delete).toHaveBeenCalledWith({ path: { id: first.id } });
        expect(client.session.delete).not.toHaveBeenCalledWith({ path: { id: second.id } });
    });

    it("forgets a session that never becomes idle", async () => {
        const session = await registry.acquire("worker", "parent", "task");
        client.setStatus({ [session.id]: { type: "busy" } });
        await registry.release(session.id);
        await vi.advanceTimersByTimeAsync(DELETE_MAX_DEFER_MS + DELETE_RETRY_MS * 2);
        expect(client.session.delete).not.toHaveBeenCalled();
        const checks = client.session.status.mock.calls.length;
        await registry.invalidate(session.id);
        expect(client.session.status).toHaveBeenCalledTimes(checks);
        expect(client.session.delete).not.toHaveBeenCalled();
    });

    it("forgets a session already deleted by the host", async () => {
        const session = await registry.acquire("worker", "parent", "task");
        registry.forget(session.id);
        await registry.release(session.id);
        await registry.invalidate(session.id);
        expect(client.session.delete).not.toHaveBeenCalled();
    });

    it("forgets a session when the plugin API cannot delete it", async () => {
        client.session.delete.mockRejectedValueOnce(new SessionDeletionUnavailableError());
        const session = await registry.acquire("worker", "parent", "task");
        await registry.release(session.id);
        await vi.advanceTimersByTimeAsync(DELETE_SETTLE_MS + 1);
        await registry.invalidate(session.id);
        expect(client.session.delete).toHaveBeenCalledTimes(1);
    });

    it.each([{ error: "permission denied" }, { data: false }])(
        "keeps a session indexed when the host does not confirm deletion: %j",
        async response => {
            client.session.delete.mockResolvedValueOnce(response);
            const session = await registry.acquire("worker", "parent", "task");
            session.inUse = false;
            session.lastUsedAt = new Date(Date.now() - DELETE_SETTLE_MS * 2);
            await registry.invalidate(session.id);
            expect(client.session.delete).toHaveBeenCalledOnce();
            await registry.invalidate(session.id);
            expect(client.session.delete).toHaveBeenCalledTimes(2);
        },
    );

    it("retries a failed host deletion during stale-session cleanup", async () => {
        client.session.delete.mockRejectedValueOnce(new Error("temporary failure"));
        const session = await registry.acquire("worker", "parent", "task");
        session.inUse = false;
        session.lastUsedAt = new Date(Date.now() - 600_000);
        await registry.invalidate(session.id);
        expect(client.session.delete).toHaveBeenCalledOnce();

        expect(await registry.cleanup()).toBe(1);
        expect(client.session.delete).toHaveBeenCalledTimes(2);
        await registry.invalidate(session.id);
        expect(client.session.delete).toHaveBeenCalledTimes(2);
    });

    it("shutdown skips in-use and unsettled sessions", async () => {
        const inUse = await registry.acquire("worker", "parent", "running");
        const fresh = await registry.acquire("worker", "parent", "fresh");
        await registry.release(fresh.id);
        await registry.shutdown();
        expect(client.session.delete).not.toHaveBeenCalledWith({ path: { id: inUse.id } });
        expect(client.session.delete).not.toHaveBeenCalledWith({ path: { id: fresh.id } });
    });

    it("shutdown deletes a settled idle session", async () => {
        const session = await registry.acquire("worker", "parent", "old");
        session.inUse = false;
        session.lastUsedAt = new Date(Date.now() - DELETE_SETTLE_MS * 2);
        await registry.shutdown();
        expect(client.session.delete).toHaveBeenCalledWith({ path: { id: session.id } });
    });
});
