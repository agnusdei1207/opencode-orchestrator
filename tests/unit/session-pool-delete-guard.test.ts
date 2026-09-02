/**
 * SessionPool deletion guards (issue #41)
 *
 * OpenCode keeps projecting `message`/`part` rows for a session shortly after
 * a run reports idle, and deleting the session row cascades over those tables.
 * A delete issued while the session is in use, busy, or not yet settled makes
 * the host's own inserts fail with `FOREIGN KEY constraint failed` and loses
 * the task result. These tests pin every guard on the delete path.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
    SessionPool,
    DELETE_SETTLE_MS,
    DELETE_RETRY_MS,
    DELETE_MAX_DEFER_MS,
} from "../../src/core/agents/session-pool";
import {
    resetSessionActivity,
    touchSessionActivity,
} from "../../src/core/session/activity";

type StatusMap = Record<string, { type: string }>;

function createClient(initialStatus: StatusMap = {}) {
    let statuses = initialStatus;
    let nextID = 0;
    return {
        setStatus(next: StatusMap) {
            statuses = next;
        },
        session: {
            create: vi.fn().mockImplementation(async () => ({ data: { id: `ses_${++nextID}` } })),
            delete: vi.fn().mockResolvedValue({}),
            status: vi.fn().mockImplementation(async () => ({ data: statuses })),
        },
    };
}

describe("SessionPool (deletion guards)", () => {
    let client: ReturnType<typeof createClient>;
    let pool: SessionPool;

    beforeEach(() => {
        vi.useFakeTimers();
        resetSessionActivity();
        client = createClient();
        // @ts-expect-error reset the singleton between tests
        SessionPool._instance = null;
        pool = SessionPool.getInstance(client as never, "/tmp/test-pool");
    });

    afterEach(() => {
        vi.useRealTimers();
        resetSessionActivity();
    });

    it("never deletes an in-use session; the request runs after release and settle", async () => {
        const session = await pool.acquire("worker", "parent", "task");

        await pool.invalidate(session.id);
        expect(client.session.delete).not.toHaveBeenCalled();
        expect(session.deleteRequested).toBe(true);

        await pool.release(session.id);
        expect(client.session.delete).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(DELETE_SETTLE_MS + 1);
        expect(client.session.delete).toHaveBeenCalledWith({ path: { id: session.id } });
        expect(pool.getStats().totalSessions).toBe(0);
    });

    it("waits for the host to report idle before deleting a released session", async () => {
        const session = await pool.acquire("worker", "parent", "task");
        client.setStatus({ [session.id]: { type: "busy" } });

        await pool.release(session.id);
        await vi.advanceTimersByTimeAsync(DELETE_SETTLE_MS + DELETE_RETRY_MS);
        expect(client.session.delete).not.toHaveBeenCalled();

        client.setStatus({});
        await vi.advanceTimersByTimeAsync(DELETE_RETRY_MS + DELETE_SETTLE_MS + 1);
        expect(client.session.delete).toHaveBeenCalledWith({ path: { id: session.id } });
    });

    it("keeps the settle window open while host events keep arriving for the session", async () => {
        const session = await pool.acquire("worker", "parent", "task");
        await pool.release(session.id);

        await vi.advanceTimersByTimeAsync(DELETE_SETTLE_MS - 1_000);
        touchSessionActivity(session.id); // a trailing message.part.updated
        await vi.advanceTimersByTimeAsync(2_000);
        expect(client.session.delete).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(DELETE_SETTLE_MS);
        expect(client.session.delete).toHaveBeenCalledTimes(1);
    });

    it("cancels a deferred deletion when the session is reacquired", async () => {
        const session = await pool.acquire("worker", "parent", "task");
        session.deleteRequested = true;
        // Reuse only works for a healthy session; without a compaction API the
        // pool retires released sessions, so pin the state a reuse would see.
        (client as unknown as { v2: unknown }).v2 = { session: { compact: vi.fn().mockResolvedValue({}) } };
        await pool.release(session.id);

        const reacquired = await pool.acquire("worker", "parent", "task-2");
        expect(reacquired.id).toBe(session.id);
        expect(reacquired.deleteRequested).toBe(false);

        await vi.advanceTimersByTimeAsync(DELETE_SETTLE_MS * 2);
        expect(client.session.delete).not.toHaveBeenCalled();
    });

    it("gives up on a session that never goes idle instead of deleting it mid-run", async () => {
        const session = await pool.acquire("worker", "parent", "task");
        client.setStatus({ [session.id]: { type: "busy" } });

        await pool.release(session.id);
        await vi.advanceTimersByTimeAsync(DELETE_MAX_DEFER_MS + DELETE_RETRY_MS * 2);

        expect(client.session.delete).not.toHaveBeenCalled();
        expect(pool.getStats().totalSessions).toBe(0);
    });

    it("forgets a session the host already deleted without calling the server", async () => {
        const session = await pool.acquire("worker", "parent", "task");

        pool.forget(session.id);

        expect(client.session.delete).not.toHaveBeenCalled();
        expect(pool.getStats().totalSessions).toBe(0);
        // A later release is a no-op rather than an error.
        await expect(pool.release(session.id)).resolves.toBeUndefined();
    });

    it("does not reuse an age-retired session before its deferred delete (uncompacted context leak)", async () => {
        // Compaction available so a normal release would keep the session pooled.
        (client as unknown as { v2: unknown }).v2 = { session: { compact: vi.fn().mockResolvedValue({}) } };
        const session = await pool.acquire("worker", "parent", "task");
        // Force the age-retire path: too old, but reuseCount still under the max.
        session.createdAt = new Date(Date.now() - 60 * 60_000);

        await pool.release(session.id);

        // A retired session is not compacted; it must be unhealthy so acquire
        // cannot hand its stale transcript to the next task.
        expect(session.health).toBe("degraded");
        const next = await pool.acquire("worker", "parent", "task-2");
        expect(next.id).not.toBe(session.id);
    });

    it("shutdown() leaves in-use and unsettled sessions alone and deletes settled idle ones", async () => {
        // With a compaction API released sessions stay pooled, so shutdown is
        // what decides their fate rather than a deferred retirement timer.
        (client as unknown as { v2: unknown }).v2 = { session: { compact: vi.fn().mockResolvedValue({}) } };
        const inUse = await pool.acquire("worker", "parent", "running");
        const settled = await pool.acquire("worker", "parent", "old");
        const justReleased = await pool.acquire("worker", "parent", "fresh");

        await pool.release(settled.id);
        await vi.advanceTimersByTimeAsync(DELETE_SETTLE_MS + 1);
        await pool.release(justReleased.id);

        await pool.shutdown();

        const deletedIDs = client.session.delete.mock.calls.map(([call]) => call.path.id);
        expect(deletedIDs).toEqual([settled.id]);
        expect(deletedIDs).not.toContain(inUse.id);
        expect(deletedIDs).not.toContain(justReleased.id);
    });
});
