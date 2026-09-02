/**
 * SessionPool Reset/Isolation Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { SessionPool, DELETE_SETTLE_MS } from "../../src/core/agents/session-pool";
import { resetSessionActivity } from "../../src/core/session/activity";

describe("SessionPool (Reset & Isolation)", () => {
    let mockClient: any;
    let pool: SessionPool;
    const directory = "/tmp/test-pool";

    beforeEach(() => {
        vi.useFakeTimers();
        resetSessionActivity();
        mockClient = {
            session: {
                create: vi.fn().mockResolvedValue({ data: { id: "new-session-id" } }),
                delete: vi.fn().mockResolvedValue({}),
            },
            v2: {
                session: {
                    compact: vi.fn().mockResolvedValue({}),
                },
            },
        };
        // @ts-ignore
        SessionPool._instance = null;
        pool = SessionPool.getInstance(mockClient, directory);
    });

    afterEach(() => {
        vi.useRealTimers();
        resetSessionActivity();
    });

    /** Deletions are deferred until the host has settled (issue #41). */
    async function settle(): Promise<void> {
        await vi.advanceTimersByTimeAsync(DELETE_SETTLE_MS + 1);
    }

    it("should compact session through the OpenCode v2 API upon release", async () => {
        // 1. Acquire
        const session = await pool.acquire("worker", "parent", "task");
        const sessionId = session.id;

        // 2. Release
        await pool.release(sessionId);

        expect(mockClient.v2.session.compact).toHaveBeenCalledWith({
            sessionID: sessionId,
        });

        // Verify metadata update
        expect(session.lastResetAt).toBeDefined();
        expect(session.health).toBe("healthy");
    });

    it("invalidates sessions instead of reusing them when no compact API is available", async () => {
        mockClient.v2.session.compact = undefined;

        const session = await pool.acquire("worker", "parent", "task");

        await pool.release(session.id);
        expect(session.health).toBe("degraded");
        expect(session.inUse).toBe(false);

        await settle();
        expect(mockClient.session.delete).toHaveBeenCalledWith({
            path: { id: session.id }
        });
        expect(pool.getStats().totalSessions).toBe(0);
    });

    it("should invalidate session if compact fails", async () => {
        mockClient.v2.session.compact.mockRejectedValue(new Error("Compact failed"));

        const session = await pool.acquire("worker", "parent", "task");
        await pool.release(session.id);
        expect(session.health).toBe("degraded");

        await settle();
        expect(mockClient.session.delete).toHaveBeenCalledWith({
            path: { id: session.id }
        });
        expect(pool.getStats().totalSessions).toBe(0);
    });

    it("should invalidate session if reuse count exceeded", async () => {
        const session = await pool.acquire("worker", "parent", "task");
        session.reuseCount = 100; // Force exceed max

        await pool.release(session.id);
        await settle();

        // Should be deleted, not just released
        expect(mockClient.session.delete).toHaveBeenCalled();
        expect(mockClient.v2.session.compact).not.toHaveBeenCalled();
    });

    it("keeps failed remote deletes indexed and marks them unhealthy", async () => {
        mockClient.session.delete.mockRejectedValueOnce(new Error("delete failed"));
        const session = await pool.acquire("worker", "parent", "task");
        session.inUse = false;
        session.lastUsedAt = new Date(Date.now() - DELETE_SETTLE_MS * 2);

        await pool.invalidate(session.id);

        expect(session.health).toBe("unhealthy");
        expect(pool.getStats().totalSessions).toBe(1);
    });

    it("deletes the oldest available session when the agent pool is full", async () => {
        (pool as unknown as { config: { maxPoolSizePerAgent: number } }).config.maxPoolSizePerAgent = 1;
        mockClient.session.create
            .mockResolvedValueOnce({ data: { id: "session-1" } })
            .mockResolvedValueOnce({ data: { id: "session-2" } });

        const oldest = await pool.acquire("worker", "parent", "first");
        const newest = await pool.acquire("worker", "parent", "second");
        oldest.lastUsedAt = new Date(0);
        newest.lastUsedAt = new Date(1);

        await pool.release(oldest.id);
        await pool.release(newest.id);
        await settle();

        expect(mockClient.session.delete).toHaveBeenCalledWith({
            path: { id: oldest.id },
        });
        expect(pool.getStats().totalSessions).toBe(1);
    });
});
