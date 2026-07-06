import { HISTORY, LIMITS } from "../../shared/index.js";

/**
 * Progress Store - Session data management
 */

export interface TodoProgress {
    total: number;
    completed: number;
    pending: number;
    percentage: number;
}

export interface TaskProgress {
    total: number;
    running: number;
    completed: number;
    failed: number;
    percentage: number;
}

export interface StepProgress {
    current: number;
    max: number;
}

export interface ProgressSnapshot {
    sessionId: string;
    timestamp: Date;
    todos: TodoProgress;
    tasks: TaskProgress;
    steps: StepProgress;
    startedAt: Date;
    elapsedMs: number;
}

export interface SnapshotInput {
    todoTotal?: number;
    todoCompleted?: number;
    taskTotal?: number;
    taskRunning?: number;
    taskCompleted?: number;
    taskFailed?: number;
    currentStep?: number;
    maxSteps?: number;
}

// Progress history by session
const progressHistory = new Map<string, ProgressSnapshot[]>();
const sessionStartTimes = new Map<string, Date>();

const DEFAULT_COUNT = 0;
const UNLIMITED_STEPS = Infinity;

/**
 * Start tracking a session
 */
export function startSession(sessionId: string): void {
    sessionStartTimes.set(sessionId, new Date());
    progressHistory.set(sessionId, []);
}

/**
 * Get session start time
 */
export function getSessionStart(sessionId: string): Date | undefined {
    return sessionStartTimes.get(sessionId);
}

/**
 * Record a progress snapshot
 */
export function recordSnapshot(sessionId: string, data: SnapshotInput): ProgressSnapshot {
    const startedAt = sessionStartTimes.get(sessionId) || new Date();
    const now = new Date();
    const snapshot = buildSnapshot(sessionId, data, startedAt, now);

    appendSnapshot(sessionId, snapshot);
    return snapshot;
}

function buildSnapshot(
    sessionId: string,
    data: SnapshotInput,
    startedAt: Date,
    now: Date,
): ProgressSnapshot {
    return {
        sessionId,
        timestamp: now,
        todos: buildTodoProgress(data),
        tasks: buildTaskProgress(data),
        steps: buildStepProgress(data),
        startedAt,
        elapsedMs: now.getTime() - startedAt.getTime(),
    };
}

function buildTodoProgress(data: SnapshotInput): TodoProgress {
    const total = readCount(data.todoTotal);
    const completed = readCount(data.todoCompleted);

    return {
        total,
        completed,
        pending: total - completed,
        percentage: calculatePercentage(completed, total),
    };
}

function buildTaskProgress(data: SnapshotInput): TaskProgress {
    const total = readCount(data.taskTotal);
    const completed = readCount(data.taskCompleted);
    const failed = readCount(data.taskFailed);

    return {
        total,
        running: readCount(data.taskRunning),
        completed,
        failed,
        percentage: calculatePercentage(completed + failed, total),
    };
}

function buildStepProgress(data: SnapshotInput): StepProgress {
    return {
        current: readCount(data.currentStep),
        max: data.maxSteps || UNLIMITED_STEPS,
    };
}

function calculatePercentage(completed: number, total: number): number {
    return total ? Math.round(completed / total * 100) : DEFAULT_COUNT;
}

function readCount(value: number | undefined): number {
    return value || DEFAULT_COUNT;
}

function appendSnapshot(sessionId: string, snapshot: ProgressSnapshot): void {
    const history = progressHistory.get(sessionId) || [];
    history.push(snapshot);

    if (history.length > HISTORY.MAX_PROGRESS) {
        history.shift();
    }

    progressHistory.set(sessionId, history);
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
export function getHistory(sessionId: string, limit: number = LIMITS.DEFAULT_LIST_LIMIT): ProgressSnapshot[] {
    const history = progressHistory.get(sessionId) || [];
    return history.slice(-limit);
}

/**
 * Clear session data
 */
export function clearSession(sessionId: string): void {
    progressHistory.delete(sessionId);
    sessionStartTimes.delete(sessionId);
}
