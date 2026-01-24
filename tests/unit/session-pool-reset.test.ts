/**
 * SessionPool Reset/Isolation Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { SessionPool } from "../../src/core/agents/session-pool";
import { PARALLEL_TASK } from "../../src/shared";

describe("SessionPool (Reset & Isolation)", () => {
    let mockClient: any;
    let pool: SessionPool;
    const directory = "/tmp/test-pool";

    beforeEach(() => {
        mockClient = {
            session: {
                create: vi.fn().mockResolvedValue({ data: { id: "new-session-id" } }),
                delete: vi.fn().mockResolvedValue({}),
                compact: vi.fn().mockResolvedValue({}),
            }
        };
        // @ts-ignore
        SessionPool._instance = null;
        pool = SessionPool.getInstance(mockClient, directory);
    });

    it("should compact session upon release", async () => {
        // 1. Acquire
        const session = await pool.acquire("worker", "parent", "task");
        const sessionId = session.id;

        // 2. Release
        await pool.release(sessionId);

        // Verify compact was called
        expect(mockClient.session.compact).toHaveBeenCalledWith({
            path: { id: sessionId }
        });

        // Verify metadata update
        expect(session.lastResetAt).toBeDefined();
        expect(session.health).toBe("healthy");
    });

    it("should mark session as degraded if compact fails", async () => {
        mockClient.session.compact.mockRejectedValue(new Error("Compact failed"));

        const session = await pool.acquire("worker", "parent", "task");
        await pool.release(session.id);

        expect(session.health).toBe("degraded");
        // Still available in pool though? (Current implementation says yes)
        expect(session.inUse).toBe(false);
    });

    it("should invalidate session if reuse count exceeded", async () => {
        const session = await pool.acquire("worker", "parent", "task");
        session.reuseCount = 100; // Force exceed max

        await pool.release(session.id);

        // Should be deleted, not just released
        expect(mockClient.session.delete).toHaveBeenCalled();
    });
});
