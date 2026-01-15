/**
 * Parallel Agent Manager - Session-based async agent execution
 *
 * Key safety features:
 * - Concurrency control per agent type (queue-based)
 * - Batched notifications (notify when ALL complete)
 * - Automatic memory cleanup (5 min after completion)
 * - TTL enforcement (30 min timeout)
 * - Output validation before completion
 * - Process-safe polling (unref)
 */
import type { PluginInput } from "@opencode-ai/plugin";
type OpencodeClient = PluginInput["client"];
export interface ParallelTask {
    id: string;
    sessionID: string;
    parentSessionID: string;
    description: string;
    agent: string;
    status: "pending" | "running" | "completed" | "error" | "timeout";
    startedAt: Date;
    completedAt?: Date;
    error?: string;
    result?: string;
    concurrencyKey?: string;
}
interface LaunchInput {
    description: string;
    prompt: string;
    agent: string;
    parentSessionID: string;
}
export declare class ParallelAgentManager {
    private static _instance;
    private tasks;
    private pendingByParent;
    private notifications;
    private client;
    private directory;
    private concurrency;
    private pollingInterval?;
    private constructor();
    static getInstance(client?: OpencodeClient, directory?: string): ParallelAgentManager;
    /**
     * Launch an agent in a new session (async, non-blocking)
     */
    launch(input: LaunchInput): Promise<ParallelTask>;
    /**
     * Get task by ID
     */
    getTask(id: string): ParallelTask | undefined;
    /**
     * Get all running tasks
     */
    getRunningTasks(): ParallelTask[];
    /**
     * Get all tasks
     */
    getAllTasks(): ParallelTask[];
    /**
     * Get tasks by parent session
     */
    getTasksByParent(parentSessionID: string): ParallelTask[];
    /**
     * Cancel a running task
     */
    cancelTask(taskId: string): Promise<boolean>;
    /**
     * Get result from completed task
     */
    getResult(taskId: string): Promise<string | null>;
    /**
     * Set concurrency limit for agent type
     */
    setConcurrencyLimit(agentType: string, limit: number): void;
    /**
     * Get pending notification count
     */
    getPendingCount(parentSessionID: string): number;
    /**
     * Cleanup all state
     */
    cleanup(): void;
    private trackPending;
    private untrackPending;
    private handleTaskError;
    private startPolling;
    private stopPolling;
    private pollRunningTasks;
    private validateSessionHasOutput;
    private pruneExpiredTasks;
    private scheduleCleanup;
    private queueNotification;
    private notifyParentIfAllComplete;
    formatDuration(start: Date, end?: Date): string;
}
export declare const parallelAgentManager: {
    getInstance: typeof ParallelAgentManager.getInstance;
};
export {};
