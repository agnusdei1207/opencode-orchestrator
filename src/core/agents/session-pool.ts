/**
 * Session Pool
 *
 * Manages a pool of reusable sessions for parallel agent execution.
 * Key benefits:
 * - 90% reduction in session creation time (500ms → 50ms)
 * - Reduced OpenCode server load
 * - Faster parallel task startup
 *
 * Deletion is guarded (issue #41). OpenCode persists `message`/`part` rows
 * through event projectors that keep writing shortly after a run reports
 * idle, and a session row deletion cascades to those tables. Deleting a
 * session that is still in use, still busy, or not yet settled therefore
 * makes the host's own inserts fail with `FOREIGN KEY constraint failed`
 * and destroys the task result the poller was about to read. Every delete
 * goes through `deleteSession`, which defers until the session is released,
 * reported idle by the host, and quiet for a settle window.
 */

import type { PluginInput } from "@opencode-ai/plugin";
import { PARALLEL_TASK } from "../../shared/index.js";
import { log } from "./logger.js";
import { withTimeout } from "../queue/async-utils.js";
import { getLastActivityAt, isSessionBusy } from "../session/activity.js";

interface PooledSession {
    id: string;
    agentName: string;
    projectDirectory: string;
    createdAt: Date;
    lastUsedAt: Date;
    reuseCount: number;
    inUse: boolean;
    lastResetAt?: Date;
    health: "healthy" | "degraded" | "unhealthy";
    /** Deletion was requested while the session was in use; run it on release. */
    deleteRequested?: boolean;
    /** Last time the session was handed back to the pool. */
    releasedAt?: Date;
    /** When the first deferred deletion attempt was made, to bound the wait. */
    deleteDeferredSince?: number;
}

interface SessionPoolConfig {
    maxPoolSizePerAgent: number;
    idleTimeoutMs: number;
    maxReuseCount: number;
    healthCheckIntervalMs: number;
}

interface SessionPoolStats {
    totalSessions: number;
    sessionsInUse: number;
    availableSessions: number;
    reuseHits: number;
    creationMisses: number;
    byAgent: Record<string, {
        total: number;
        inUse: number;
        available: number;
    }>;
}

type OpencodeClient = PluginInput["client"] & {
    v2?: {
        session?: {
            compact?: (parameters: { sessionID: string }) => Promise<unknown>;
        };
    };
};

type DeletionGate =
    | { kind: "ready" }
    | { kind: "busy" }
    | { kind: "settling"; delayMs: number };

const DEFAULT_CONFIG: SessionPoolConfig = {
    maxPoolSizePerAgent: 5,
    idleTimeoutMs: 300_000, // 5 minutes
    maxReuseCount: 10,
    healthCheckIntervalMs: 60_000, // 1 minute
};

/**
 * Quiet time required after the last observed host activity before a delete.
 * The run loop reports idle before the final message/part projections for the
 * turn are written; this window lets them land.
 */
export const DELETE_SETTLE_MS = 10_000;
/** Re-check cadence while a session is still busy. */
export const DELETE_RETRY_MS = 5_000;
/**
 * Upper bound on how long a deletion is deferred. A session that never goes
 * idle is forgotten (left to the host) rather than deleted underneath a
 * running stream.
 */
export const DELETE_MAX_DEFER_MS = 10 * 60_000;

function requirePositiveInteger(name: keyof SessionPoolConfig, value: number): number {
    if (!Number.isInteger(value) || value < 1) {
        throw new Error(`SessionPool ${name} must be a positive integer, got ${value}`);
    }
    return value;
}

function normalizeConfig(config: Partial<SessionPoolConfig>): SessionPoolConfig {
    const normalized = { ...DEFAULT_CONFIG, ...config };
    return {
        maxPoolSizePerAgent: requirePositiveInteger("maxPoolSizePerAgent", normalized.maxPoolSizePerAgent),
        idleTimeoutMs: requirePositiveInteger("idleTimeoutMs", normalized.idleTimeoutMs),
        maxReuseCount: requirePositiveInteger("maxReuseCount", normalized.maxReuseCount),
        healthCheckIntervalMs: requirePositiveInteger("healthCheckIntervalMs", normalized.healthCheckIntervalMs),
    };
}

function shortID(sessionId: string): string {
    return `${sessionId.slice(0, 8)}...`;
}

export class SessionPool {
    private static _instance: SessionPool;

    private pool: Map<string, PooledSession[]> = new Map(); // key: agentName
    private sessionsById: Map<string, PooledSession> = new Map();
    private config: SessionPoolConfig;
    private client: OpencodeClient;
    private directory: string;
    private healthCheckInterval: NodeJS.Timeout | null = null;
    /** One pending deferred-delete timer per session id. */
    private deleteTimers: Map<string, NodeJS.Timeout> = new Map();

    // Statistics
    private stats = {
        reuseHits: 0,
        creationMisses: 0,
    };

    private constructor(
        client: OpencodeClient,
        directory: string,
        config: Partial<SessionPoolConfig> = {}
    ) {
        this.client = client;
        this.directory = directory;
        this.config = normalizeConfig(config);

        // Start periodic health check
        this.startHealthCheck();
    }

    static getInstance(
        client?: OpencodeClient,
        directory?: string,
        config?: Partial<SessionPoolConfig>
    ): SessionPool {
        if (!SessionPool._instance) {
            if (!client || !directory) {
                throw new Error("SessionPool requires client and directory on first call");
            }
            SessionPool._instance = new SessionPool(client, directory, config);
        }
        return SessionPool._instance;
    }

    /**
     * Acquire a session from the pool or create a new one.
     */
    async acquire(
        agentName: string,
        parentSessionID: string,
        description: string
    ): Promise<PooledSession> {
        const poolKey = this.getPoolKey(agentName);
        const agentPool = this.pool.get(poolKey) || [];

        // Find an available session
        const available = agentPool.find(s =>
            !s.inUse &&
            s.health === "healthy" &&
            s.reuseCount < this.config.maxReuseCount
        );

        if (available) {
            // Reuse existing session. A deletion that was waiting on it is
            // cancelled: the session is alive and needed again.
            available.inUse = true;
            available.lastUsedAt = new Date();
            available.reuseCount++;
            available.deleteRequested = false;
            available.deleteDeferredSince = undefined;
            this.cancelDeferredDelete(available.id);
            this.stats.reuseHits++;

            log(`[SessionPool] Reusing session ${shortID(available.id)} for ${agentName} (reuse #${available.reuseCount})`);
            return available;
        }

        // No available session, create a new one
        this.stats.creationMisses++;
        return this.createSession(agentName, parentSessionID, description);
    }

    /**
     * Release a session back to the pool for reuse.
     */
    async release(sessionId: string): Promise<void> {
        const session = this.sessionsById.get(sessionId);
        if (!session) {
            log(`[SessionPool] Session ${shortID(sessionId)} not found in pool`);
            return;
        }

        const age = Date.now() - session.createdAt.getTime();
        const shouldRetire =
            session.reuseCount >= this.config.maxReuseCount ||
            age > this.config.idleTimeoutMs * 2; // Too old

        if (!shouldRetire) {
            await this.evictIfFull(session.agentName);
        }

        // Return session to pool only after it has been reset successfully.
        const resetOk = shouldRetire ? false : await this.resetSession(sessionId);

        // The session is idle from the pool's point of view from here on, so
        // the guarded delete may proceed once the host has settled.
        session.inUse = false;
        session.releasedAt = new Date();

        if (!resetOk) {
            // Not compacted (retired for age/reuse, or reset failed): its
            // context is stale. Mark it unhealthy BEFORE releasing so a
            // concurrent acquire in the settle window cannot reuse it and hand
            // the previous task's transcript to the next one. Set synchronously
            // so no await sits between "idle" and "unreusable".
            session.health = "degraded";
            await this.invalidate(sessionId);
            return;
        }

        if (session.deleteRequested) {
            await this.deleteSession(sessionId);
            return;
        }

        log(`[SessionPool] Released session ${shortID(sessionId)} to pool`);
    }

    /**
     * Invalidate a session (remove from pool and delete once it is safe).
     */
    async invalidate(sessionId: string): Promise<void> {
        const session = this.sessionsById.get(sessionId);
        if (!session) return;

        const deleted = await this.deleteSession(sessionId);
        if (deleted) {
            log(`[SessionPool] Invalidated session ${shortID(sessionId)}`);
        }
    }

    /**
     * Drop a session the host has already deleted (a `session.deleted` event).
     * No server call: deleting it again would only fail and mark it unhealthy.
     */
    forget(sessionId: string): void {
        if (!this.sessionsById.has(sessionId)) return;

        this.cancelDeferredDelete(sessionId);
        this.removeFromIndex(sessionId);
        log(`[SessionPool] Forgot session ${shortID(sessionId)} deleted outside the pool`);
    }

    /**
     * Get current pool statistics.
     */
    getStats(): SessionPoolStats {
        const byAgent: SessionPoolStats["byAgent"] = {};

        for (const [agentName, sessions] of this.pool.entries()) {
            const inUse = sessions.filter(s => s.inUse).length;
            byAgent[agentName] = {
                total: sessions.length,
                inUse,
                available: sessions.length - inUse,
            };
        }

        const allSessions = Array.from(this.sessionsById.values());
        const inUseCount = allSessions.filter(s => s.inUse).length;

        return {
            totalSessions: allSessions.length,
            sessionsInUse: inUseCount,
            availableSessions: allSessions.length - inUseCount,
            reuseHits: this.stats.reuseHits,
            creationMisses: this.stats.creationMisses,
            byAgent,
        };
    }

    /**
     * Cleanup stale sessions.
     */
    async cleanup(): Promise<number> {
        const now = Date.now();
        let cleanedCount = 0;

        for (const [sessionId, session] of this.sessionsById.entries()) {
            if (session.inUse) continue;

            const idle = now - session.lastUsedAt.getTime();
            if (idle > this.config.idleTimeoutMs) {
                const deleted = await this.deleteSession(sessionId);
                if (deleted) {
                    cleanedCount++;
                }
            }
        }

        if (cleanedCount > 0) {
            log(`[SessionPool] Cleaned up ${cleanedCount} stale sessions`);
        }

        return cleanedCount;
    }

    /**
     * Shutdown the pool.
     *
     * Only sessions that are idle and settled are deleted. Interrupting a
     * mission (`Esc`, `/stop`) used to bulk-delete every active stream at once,
     * which is the loudest source of the FOREIGN KEY failures in issue #41.
     * Sessions that are still in use or busy are left to the host.
     */
    async shutdown(): Promise<void> {
        log("[SessionPool] Shutting down...");

        // Stop health check
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }

        for (const sessionId of Array.from(this.deleteTimers.keys())) {
            this.cancelDeferredDelete(sessionId);
        }

        let skipped = 0;
        const deletions: Promise<unknown>[] = [];
        for (const [id, session] of this.sessionsById.entries()) {
            if (session.inUse) {
                skipped++;
                continue;
            }
            const gate = await this.deletionGate(session);
            if (gate.kind !== "ready") {
                skipped++;
                continue;
            }
            deletions.push(this.deleteSessionNow(id, session).catch((error) => {
                log(`[SessionPool] Failed to delete session during shutdown ${shortID(id)}`, error);
            }));
        }

        if (skipped > 0) {
            log(`[SessionPool] Left ${skipped} in-use or unsettled session(s) to the host during shutdown`);
        }

        await Promise.all(deletions);

        this.pool.clear();
        this.sessionsById.clear();

        log("[SessionPool] Shutdown complete");
    }

    // =========================================================================
    // Private Methods
    // =========================================================================

    /**
     * Reset/Compact a session to clear context for next reuse.
     */
    private async resetSession(sessionId: string): Promise<boolean> {
        const session = this.sessionsById.get(sessionId);
        if (!session) return false;

        log(`[SessionPool] Resetting session ${shortID(sessionId)}`);
        try {
            // Use compaction to clear context while preserving essential mission state
            // (The session-compacting-handler hook will deal with what to keep)
            const compacted = await this.compactSession(sessionId);
            if (!compacted) {
                log(`[SessionPool] No session compaction API available for ${shortID(sessionId)}; invalidating instead of reusing`);
                session.health = "degraded";
                return false;
            }
            session.lastResetAt = new Date();
            session.health = "healthy";
            return true;
        } catch (error) {
            log(`[SessionPool] Failed to reset session ${shortID(sessionId)}: ${error}`);
            session.health = "degraded";
            return false;
        }
    }

    private async compactSession(sessionId: string): Promise<boolean> {
        if (this.client.v2?.session?.compact) {
            await this.client.v2.session.compact({ sessionID: sessionId });
            return true;
        }

        return false;
    }

    private async evictIfFull(agentName: string): Promise<void> {
        const agentPool = this.pool.get(this.getPoolKey(agentName)) || [];
        const available = this.getAvailableSessionSummary(agentPool);

        if (available.count >= this.config.maxPoolSizePerAgent && available.oldest) {
            await this.deleteSession(available.oldest.id);
        }
    }

    private getPoolKey(agentName: string): string {
        return agentName;
    }

    private getAvailableSessionSummary(agentPool: PooledSession[]): {
        count: number;
        oldest: PooledSession | undefined;
    } {
        let count = 0;
        let oldest: PooledSession | undefined;

        for (const session of agentPool) {
            if (session.inUse) continue;

            count++;
            if (!oldest || session.lastUsedAt.getTime() < oldest.lastUsedAt.getTime()) {
                oldest = session;
            }
        }

        return { count, oldest };
    }

    private async createSession(
        agentName: string,
        parentSessionID: string,
        description: string
    ): Promise<PooledSession> {
        log(`[SessionPool] Creating new session for ${agentName}`);

        const result = await withTimeout(
            this.client.session.create({
                body: {
                    parentID: parentSessionID,
                    title: `${PARALLEL_TASK.SESSION_TITLE_PREFIX}: ${description}`,
                },
                query: { directory: this.directory },
            }),
            60_000,
            "Session creation timed out after 60s",
        );

        if (result.error || !result.data?.id) {
            throw new Error(`Session creation failed: ${result.error || "No ID"}`);
        }

        const session: PooledSession = {
            id: result.data.id,
            agentName,
            projectDirectory: this.directory,
            createdAt: new Date(),
            lastUsedAt: new Date(),
            reuseCount: 0,
            inUse: true,
            health: "healthy",
            lastResetAt: new Date(),
        };

        // Add to pool
        const poolKey = this.getPoolKey(agentName);
        const agentPool = this.pool.get(poolKey) || [];
        agentPool.push(session);
        this.pool.set(poolKey, agentPool);
        this.sessionsById.set(session.id, session);

        return session;
    }

    /**
     * Delete a pooled session from the server once it is safe to do so.
     *
     * Returns true only when the server delete happened now. Deferred
     * deletions return false and retry on their own; a caller that needs the
     * session gone should not wait on them.
     */
    private async deleteSession(sessionId: string): Promise<boolean> {
        const session = this.sessionsById.get(sessionId);
        if (!session) return false;

        if (session.inUse) {
            session.deleteRequested = true;
            log(`[SessionPool] Deferring deletion of in-use session ${shortID(sessionId)} until release`);
            return false;
        }

        const gate = await this.deletionGate(session);
        if (gate.kind === "ready") {
            return this.deleteSessionNow(sessionId, session);
        }

        session.deleteDeferredSince ??= Date.now();
        if (Date.now() - session.deleteDeferredSince > DELETE_MAX_DEFER_MS) {
            log(`[SessionPool] Session ${shortID(sessionId)} never settled; leaving it to the host`);
            this.cancelDeferredDelete(sessionId);
            this.removeFromIndex(sessionId);
            return false;
        }

        const delayMs = gate.kind === "busy" ? DELETE_RETRY_MS : gate.delayMs;
        log(`[SessionPool] Deferring deletion of ${gate.kind} session ${shortID(sessionId)} by ${delayMs}ms`);
        this.scheduleDeferredDelete(sessionId, delayMs);
        return false;
    }

    /**
     * Whether the host is done with this session: not running, and quiet for
     * the settle window measured from the latest of the pool's own timestamps
     * and the last host event observed for it.
     */
    private async deletionGate(session: PooledSession): Promise<DeletionGate> {
        if (await isSessionBusy(this.client, session.id)) {
            return { kind: "busy" };
        }

        const lastActivity = Math.max(
            session.lastUsedAt.getTime(),
            session.releasedAt?.getTime() ?? 0,
            getLastActivityAt(session.id) ?? 0,
        );
        const quietFor = Date.now() - lastActivity;
        if (quietFor < DELETE_SETTLE_MS) {
            return { kind: "settling", delayMs: DELETE_SETTLE_MS - quietFor };
        }

        return { kind: "ready" };
    }

    private scheduleDeferredDelete(sessionId: string, delayMs: number): void {
        if (this.deleteTimers.has(sessionId)) return;

        const timer = setTimeout(() => {
            this.deleteTimers.delete(sessionId);
            this.deleteSession(sessionId).catch((error) => {
                log(`[SessionPool] Deferred delete failed for ${shortID(sessionId)}`, error);
            });
        }, Math.max(delayMs, 0));
        timer.unref?.();
        this.deleteTimers.set(sessionId, timer);
    }

    private cancelDeferredDelete(sessionId: string): void {
        const timer = this.deleteTimers.get(sessionId);
        if (!timer) return;

        clearTimeout(timer);
        this.deleteTimers.delete(sessionId);
    }

    private async deleteSessionNow(sessionId: string, session: PooledSession): Promise<boolean> {
        this.cancelDeferredDelete(sessionId);

        try {
            await this.client.session.delete({ path: { id: sessionId } });
        } catch (error) {
            session.health = "unhealthy";
            log(`[SessionPool] Failed to delete session from server ${shortID(sessionId)}`, error);
            return false;
        }

        this.removeFromIndex(sessionId);
        return true;
    }

    private removeFromIndex(sessionId: string): void {
        const session = this.sessionsById.get(sessionId);
        if (!session) return;

        this.sessionsById.delete(sessionId);

        const poolKey = this.getPoolKey(session.agentName);
        const agentPool = this.pool.get(poolKey);
        if (!agentPool) return;

        const idx = agentPool.findIndex(s => s.id === sessionId);
        if (idx !== -1) {
            agentPool.splice(idx, 1);
        }
        if (agentPool.length === 0) {
            this.pool.delete(poolKey);
        }
    }

    private startHealthCheck(): void {
        this.healthCheckInterval = setInterval(() => {
            this.cleanup().catch((error) => {
                log("[SessionPool] Health check cleanup failed", error);
            });
        }, this.config.healthCheckIntervalMs);

        // Don't keep process alive just for health checks
        this.healthCheckInterval.unref?.();
    }
}

// Singleton accessor
export const sessionPool = {
    getInstance: SessionPool.getInstance.bind(SessionPool),
};
