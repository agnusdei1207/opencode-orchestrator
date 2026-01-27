/**
 * Session Pool Interface
 * 
 * Defines the contract for session pooling to enable session reuse
 * instead of creating new sessions for each parallel task.
 */

export interface PooledSession {
    /** Unique session ID from OpenCode */
    id: string;
    /** Agent type this session is configured for */
    agentName: string;
    /** Project/directory this session belongs to */
    projectDirectory: string;
    /** Timestamp when this session was created */
    createdAt: Date;
    /** Timestamp when this session was last used */
    lastUsedAt: Date;
    /** Number of times this session has been reused */
    reuseCount: number;
    /** Whether this session is currently in use */
    inUse: boolean;
    /** Timestamp when the session was last reset/compacted */
    lastResetAt?: Date;
    /** Health status of the session */
    health: "healthy" | "degraded" | "unhealthy";
}

export interface SessionPoolConfig {
    /** Maximum number of sessions per agent type (default: 5) */
    maxPoolSizePerAgent: number;
    /** Session idle timeout in milliseconds (default: 300000 = 5 minutes) */
    idleTimeoutMs: number;
    /** Maximum reuse count before forcing session refresh (default: 10) */
    maxReuseCount: number;
    /** Health check interval in milliseconds (default: 60000 = 1 minute) */
    healthCheckIntervalMs: number;
    /** Global maximum number of sessions across all agents (default: 30) */
    globalMax: number;
}

export interface SessionPoolStats {
    /** Total sessions in pool */
    totalSessions: number;
    /** Sessions currently in use */
    sessionsInUse: number;
    /** Sessions available for reuse */
    availableSessions: number;
    /** Number of session reuses (avoided creations) */
    reuseHits: number;
    /** Number of new session creations */
    creationMisses: number;
    /** Sessions per agent type */
    byAgent: Record<string, {
        total: number;
        inUse: number;
        available: number;
    }>;
}

export interface ISessionPool {
    /**
     * Acquire a session from the pool.
     * Returns a reused session if available, otherwise creates a new one.
     */
    acquire(agentName: string, parentSessionID: string, description: string): Promise<PooledSession>;

    /**
     * Acquire a session immediately without waiting.
     * Throws if global limit is reached.
     */
    acquireImmediate(agentName: string, parentSessionID: string, description: string): Promise<PooledSession>;

    /**
     * Release a session back to the pool for reuse.
     * The session will be reset/cleared before being put back.
     */
    release(sessionId: string): Promise<void>;

    /**
     * Invalidate a session (e.g., after error).
     * The session will be deleted and not returned to the pool.
     */
    invalidate(sessionId: string): Promise<void>;

    /**
     * Get current pool statistics.
     */
    getStats(): SessionPoolStats;

    /**
     * Perform health check and cleanup stale sessions.
     */
    cleanup(): Promise<number>;

    /**
     * Shutdown the pool, closing all sessions.
     */
    shutdown(): Promise<void>;
}
