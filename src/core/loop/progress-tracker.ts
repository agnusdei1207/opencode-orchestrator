/**
 * Progress Tracker - Snapshot-based Progress Tracking
 * 
 * Implements content-hash-based progress detection to identify when
 * agents are truly making progress vs just cycling without completion.
 */

import { log } from "../agents/logger.js";

export interface NormalizedTodo {
    id: string | null;
    content: string;
    priority: string;
    status: string;
}

export interface ProgressUpdateResult {
    hasProgressed: boolean;
    stagnationCount: number;
    previousIncompleteCount?: number;
    progressSource: "none" | "count" | "snapshot";
    recoveredFromStagnation?: boolean;
}

interface TrackerState {
    stagnationCount: number;
    lastIncompleteCount?: number;
    lastSnapshot?: string;
    awaitingPostInjectionProgressCheck: boolean;
    countCompleted?: number;
}

export const DEFAULT_STAGNATION_THRESHOLD = 3;
export const PROGRESS_GRACE_PERIOD_MS = 5000;

const sessionStates = new Map<string, TrackerState>();

export function hashTodos(todos: NormalizedTodo[]): string {
    const normalized = todos
        .map((todo) => ({
            id: todo.id ?? null,
            content: todo.content,
            priority: todo.priority,
            status: todo.status,
        }))
        .sort((left, right) => {
            const leftId = left.id ?? "\uffff";
            const rightId = right.id ?? "\uffff";
            if (leftId !== rightId) {
                return leftId.localeCompare(rightId);
            }
            if (left.content !== right.content) {
                return left.content.localeCompare(right.content);
            }
            if (left.priority !== right.priority) {
                return left.priority.localeCompare(right.priority);
            }
            return left.status.localeCompare(right.status);
        });

    return JSON.stringify(normalized);
}

export function countCompleted(todos: NormalizedTodo[]): number {
    return todos.filter((todo) => todo.status === "completed").length;
}

function getState(sessionID: string): TrackerState {
    let state = sessionStates.get(sessionID);
    if (!state) {
        state = {
            stagnationCount: 0,
            awaitingPostInjectionProgressCheck: false,
        };
        sessionStates.set(sessionID, state);
    }
    return state;
}

export function resetProgress(sessionID: string): void {
    const state = sessionStates.get(sessionID);
    if (!state) return;

    state.stagnationCount = 0;
    state.lastIncompleteCount = undefined;
    state.lastSnapshot = undefined;
    state.awaitingPostInjectionProgressCheck = false;
}

export function clearSession(sessionID: string): void {
    sessionStates.delete(sessionID);
}

export function trackProgress(
    sessionID: string,
    incompleteCount: number,
    todos?: NormalizedTodo[]
): ProgressUpdateResult {
    const state = getState(sessionID);
    const previousIncompleteCount = state.lastIncompleteCount;

    const currentSnapshot = todos ? hashTodos(todos) : undefined;
    const currentCompletedCount = todos ? countCompleted(todos) : undefined;

    const hasCompletedMoreTodos = 
        currentCompletedCount !== undefined &&
        state.lastIncompleteCount !== undefined &&
        currentCompletedCount > (state.countCompleted ?? 0);

    const hasSnapshotChanged =
        currentSnapshot !== undefined &&
        state.lastSnapshot !== undefined &&
        currentSnapshot !== state.lastSnapshot;

    let hasProgressed = false;
    let progressSource: "none" | "count" | "snapshot" = "none";

    if (incompleteCount < (previousIncompleteCount ?? Infinity)) {
        hasProgressed = true;
        progressSource = "count";
    } else if (hasSnapshotChanged) {
        hasProgressed = true;
        progressSource = "snapshot";
    }

    state.lastIncompleteCount = incompleteCount;
    if (currentSnapshot) {
        state.lastSnapshot = currentSnapshot;
    }
    if (currentCompletedCount !== undefined) {
        state.countCompleted = currentCompletedCount;
    }

    if (previousIncompleteCount === undefined) {
        state.stagnationCount = 0;
        return {
            hasProgressed: false,
            stagnationCount: 0,
            previousIncompleteCount,
            progressSource: "none",
        };
    }

    if (hasProgressed) {
        const wasStagnant = state.stagnationCount >= DEFAULT_STAGNATION_THRESHOLD;
        state.stagnationCount = 0;
        state.awaitingPostInjectionProgressCheck = false;

        log(`[progress-tracker] Progress detected: ${progressSource}`, {
            sessionID,
            previousIncompleteCount,
            incompleteCount,
            stagnationCount: state.stagnationCount,
            recoveredFromStagnation: wasStagnant,
        });

        return {
            hasProgressed: true,
            stagnationCount: state.stagnationCount,
            previousIncompleteCount,
            progressSource,
            recoveredFromStagnation: wasStagnant,
        };
    }

    if (!state.awaitingPostInjectionProgressCheck) {
        return {
            hasProgressed: false,
            stagnationCount: state.stagnationCount,
            previousIncompleteCount,
            progressSource: "none",
        };
    }

    state.stagnationCount += 1;

    log(`[progress-tracker] Stagnation detected`, {
        sessionID,
        incompleteCount,
        previousIncompleteCount,
        stagnationCount: state.stagnationCount,
        threshold: DEFAULT_STAGNATION_THRESHOLD,
    });

    return {
        hasProgressed: false,
        stagnationCount: state.stagnationCount,
        previousIncompleteCount,
        progressSource: "none",
    };
}

export function markInjectionPerformed(sessionID: string): void {
    const state = getState(sessionID);
    state.awaitingPostInjectionProgressCheck = true;
}

export function isStagnant(sessionID: string, threshold: number = DEFAULT_STAGNATION_THRESHOLD): boolean {
    const state = sessionStates.get(sessionID);
    if (!state) return false;
    return state.stagnationCount >= threshold;
}

export function getStagnationCount(sessionID: string): number {
    const state = sessionStates.get(sessionID);
    return state?.stagnationCount ?? 0;
}

export interface ProgressTracker {
    trackProgress: typeof trackProgress;
    resetProgress: typeof resetProgress;
    clearSession: typeof clearSession;
    hashTodos: typeof hashTodos;
    isStagnant: typeof isStagnant;
    getStagnationCount: typeof getStagnationCount;
    markInjectionPerformed: typeof markInjectionPerformed;
}

export function createProgressTracker(): ProgressTracker {
    return {
        trackProgress,
        resetProgress,
        clearSession,
        hashTodos,
        isStagnant,
        getStagnationCount,
        markInjectionPerformed,
    };
}
