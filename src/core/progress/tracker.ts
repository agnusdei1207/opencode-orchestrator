/**
 * Progress Tracker
 * 
 * Tracks progress of sessions, tasks, and todos
 * Provides formatted output and statistics
 */

import * as TaskDecomposer from "../task/task-decomposer.js";

export interface ProgressSnapshot {
    sessionId: string;
    timestamp: Date;
    todos: {
        total: number;
        completed: number;
        pending: number;
        percentage: number;
    };
    tasks: {
        total: number;
        running: number;
        completed: number;
        failed: number;
        percentage: number;
    };
    steps: {
        current: number;
        max: number;
    };
    startedAt: Date;
    elapsedMs: number;
}

// Progress history by session
const progressHistory = new Map<string, ProgressSnapshot[]>();
const sessionStartTimes = new Map<string, Date>();

/**
 * Start tracking a session
 */
export function startSession(sessionId: string): void {
    sessionStartTimes.set(sessionId, new Date());
    progressHistory.set(sessionId, []);
}

/**
 * Record a progress snapshot
 */
export function recordSnapshot(
    sessionId: string,
    data: {
        todoTotal?: number;
        todoCompleted?: number;
        taskTotal?: number;
        taskRunning?: number;
        taskCompleted?: number;
        taskFailed?: number;
        currentStep?: number;
        maxSteps?: number;
    }
): ProgressSnapshot {
    const startedAt = sessionStartTimes.get(sessionId) || new Date();
    const now = new Date();

    const snapshot: ProgressSnapshot = {
        sessionId,
        timestamp: now,
        todos: {
            total: data.todoTotal || 0,
            completed: data.todoCompleted || 0,
            pending: (data.todoTotal || 0) - (data.todoCompleted || 0),
            percentage: data.todoTotal
                ? Math.round((data.todoCompleted || 0) / data.todoTotal * 100)
                : 0,
        },
        tasks: {
            total: data.taskTotal || 0,
            running: data.taskRunning || 0,
            completed: data.taskCompleted || 0,
            failed: data.taskFailed || 0,
            percentage: data.taskTotal
                ? Math.round(((data.taskCompleted || 0) + (data.taskFailed || 0)) / data.taskTotal * 100)
                : 0,
        },
        steps: {
            current: data.currentStep || 0,
            max: data.maxSteps || Infinity,
        },
        startedAt,
        elapsedMs: now.getTime() - startedAt.getTime(),
    };

    const history = progressHistory.get(sessionId) || [];
    history.push(snapshot);

    // Keep last 100 snapshots
    if (history.length > 100) {
        history.shift();
    }

    progressHistory.set(sessionId, history);
    return snapshot;
}

/**
 * Get latest snapshot
 */
export function getLatest(sessionId: string): ProgressSnapshot | undefined {
    const history = progressHistory.get(sessionId);
    return history?.[history.length - 1];
}

/**
 * Get progress history
 */
export function getHistory(sessionId: string, limit = 20): ProgressSnapshot[] {
    const history = progressHistory.get(sessionId) || [];
    return history.slice(-limit);
}

/**
 * Format elapsed time
 */
export function formatElapsed(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

/**
 * Format progress bar
 */
export function formatProgressBar(percentage: number, width = 20): string {
    const filled = Math.round(width * percentage / 100);
    const empty = width - filled;
    return `[${"█".repeat(filled)}${"░".repeat(empty)}] ${percentage}%`;
}

/**
 * Get formatted progress string
 */
export function format(sessionId: string): string {
    const snapshot = getLatest(sessionId);
    if (!snapshot) return "No progress data";

    const lines: string[] = [];

    lines.push(`📊 **Progress Report**`);
    lines.push(`⏱️ Elapsed: ${formatElapsed(snapshot.elapsedMs)}`);

    if (snapshot.todos.total > 0) {
        lines.push(`✅ Todos: ${snapshot.todos.completed}/${snapshot.todos.total} ${formatProgressBar(snapshot.todos.percentage, 15)}`);
    }

    if (snapshot.tasks.total > 0) {
        lines.push(`🔄 Tasks: ${snapshot.tasks.completed}/${snapshot.tasks.total} ${formatProgressBar(snapshot.tasks.percentage, 15)}`);
        if (snapshot.tasks.running > 0) {
            lines.push(`   ⚡ ${snapshot.tasks.running} running`);
        }
        if (snapshot.tasks.failed > 0) {
            lines.push(`   ❌ ${snapshot.tasks.failed} failed`);
        }
    }

    if (snapshot.steps.max !== Infinity) {
        lines.push(`📍 Step: ${snapshot.steps.current}/${snapshot.steps.max}`);
    } else {
        lines.push(`📍 Step: ${snapshot.steps.current} (unlimited)`);
    }

    return lines.join("\n");
}

/**
 * Get compact progress string (for inline display)
 */
export function formatCompact(sessionId: string): string {
    const snapshot = getLatest(sessionId);
    if (!snapshot) return "...";

    const parts: string[] = [];

    if (snapshot.todos.total > 0) {
        parts.push(`✅${snapshot.todos.completed}/${snapshot.todos.total}`);
    }

    if (snapshot.tasks.running > 0) {
        parts.push(`⚡${snapshot.tasks.running}`);
    }

    parts.push(`⏱${formatElapsed(snapshot.elapsedMs)}`);

    return parts.join(" | ");
}

/**
 * Calculate rate (items per minute)
 */
export function calculateRate(sessionId: string): number {
    const snapshot = getLatest(sessionId);
    if (!snapshot || snapshot.elapsedMs === 0) return 0;

    const completedItems = snapshot.todos.completed + snapshot.tasks.completed;
    const minutes = snapshot.elapsedMs / 60000;

    return Math.round(completedItems / minutes * 10) / 10;
}

/**
 * Estimate remaining time
 */
export function estimateRemaining(sessionId: string): number | undefined {
    const snapshot = getLatest(sessionId);
    if (!snapshot) return undefined;

    const rate = calculateRate(sessionId);
    if (rate === 0) return undefined;

    const remaining = snapshot.todos.pending +
        (snapshot.tasks.total - snapshot.tasks.completed - snapshot.tasks.failed);

    return remaining / rate * 60000;  // ms
}

/**
 * Clear session data
 */
export function clearSession(sessionId: string): void {
    progressHistory.delete(sessionId);
    sessionStartTimes.delete(sessionId);
}
