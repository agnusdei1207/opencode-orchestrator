/**
 * Todo Continuation Handler
 * 
 * Monitors session.idle events and automatically continues execution
 * if there are incomplete todos remaining.
 * 
 * Features:
 * - Countdown toast before resuming (gives user chance to cancel)
 * - Skips if background tasks are running
 * - Respects abort/cancel from user
 */

import type { PluginInput } from "@opencode-ai/plugin";
import { PART_TYPES } from "../../shared/constants.js";
import { log } from "../agents/logger.js";
import { presets } from "../notification/presets.js";
import { getIncompleteCount, hasRemainingWork, getNextPending } from "./stats.js";
import { generateContinuationPrompt, formatProgress } from "./formatters.js";
import type { Todo } from "./interfaces.js";
import { ParallelAgentManager } from "../agents/manager.js";
import { isSessionRecovering } from "../recovery/session-recovery.js";

type OpencodeClient = PluginInput["client"];

// State per session
interface ContinuationState {
    countdownTimer?: ReturnType<typeof setTimeout>;
    countdownStartedAt?: number;
    isAborting?: boolean;
    lastIdleTime?: number;
}

const sessionStates = new Map<string, ContinuationState>();

// Configuration
const COUNTDOWN_SECONDS = 2;
const TOAST_DURATION_MS = 1500;
const MIN_TIME_BETWEEN_CONTINUATIONS_MS = 3000;

/**
 * Get or create continuation state for a session
 */
function getState(sessionID: string): ContinuationState {
    let state = sessionStates.get(sessionID);
    if (!state) {
        state = {};
        sessionStates.set(sessionID, state);
    }
    return state;
}

/**
 * Cancel any pending countdown
 */
function cancelCountdown(sessionID: string): void {
    const state = sessionStates.get(sessionID);
    if (state?.countdownTimer) {
        clearTimeout(state.countdownTimer);
        state.countdownTimer = undefined;
        state.countdownStartedAt = undefined;
    }
}

/**
 * Parse todos from OpenCode session.todo API response
 */
function parseTodos(data: unknown): Todo[] {
    if (!Array.isArray(data)) return [];
    return data.filter((item): item is Todo =>
        item && typeof item === "object" && "id" in item && "status" in item
    ).map(item => ({
        id: item.id,
        content: item.content || "",
        status: item.status || "pending",
        priority: item.priority || "medium",
        createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
    }));
}

/**
 * Check if session has running background tasks
 */
function hasRunningBackgroundTasks(parentSessionID: string): boolean {
    try {
        const manager = ParallelAgentManager.getInstance();
        const tasks = manager.getTasksByParent(parentSessionID);
        return tasks.some(t => t.status === "running");
    } catch {
        return false;
    }
}

/**
 * Show countdown toast
 */
async function showCountdownToast(
    client: OpencodeClient,
    secondsRemaining: number,
    incompleteCount: number
): Promise<void> {
    try {
        const tuiClient = client as unknown as { tui?: { showToast?: (opts: unknown) => Promise<void> } };
        if (tuiClient.tui?.showToast) {
            await tuiClient.tui.showToast({
                body: {
                    title: "📋 Todo Continuation",
                    message: `Resuming in ${secondsRemaining}s... (${incompleteCount} tasks remaining)`,
                    variant: "warning",
                    duration: TOAST_DURATION_MS,
                },
            });
        }
    } catch {
        // Toast failed, continue anyway
    }
}

/**
 * Inject continuation prompt to session
 */
async function injectContinuation(
    client: OpencodeClient,
    sessionID: string,
    todos: Todo[]
): Promise<void> {
    const state = getState(sessionID);

    // Double-check conditions before injecting
    if (state.isAborting) {
        log("[todo-continuation] Skipped: user is aborting", { sessionID });
        return;
    }

    if (hasRunningBackgroundTasks(sessionID)) {
        log("[todo-continuation] Skipped: background tasks running", { sessionID });
        return;
    }

    if (isSessionRecovering(sessionID)) {
        log("[todo-continuation] Skipped: session is recovering from error", { sessionID });
        return;
    }

    // Generate continuation prompt
    const prompt = generateContinuationPrompt(todos);
    if (!prompt) {
        log("[todo-continuation] Skipped: no continuation prompt needed", { sessionID });
        return;
    }

    try {
        await client.session.prompt({
            path: { id: sessionID },
            body: {
                parts: [{ type: PART_TYPES.TEXT, text: prompt }],
            },
        });
        log("[todo-continuation] Injected continuation prompt", {
            sessionID,
            incompleteCount: getIncompleteCount(todos),
            progress: formatProgress(todos),
        });
    } catch (error) {
        log("[todo-continuation] Failed to inject continuation", { sessionID, error });
    }
}

/**
 * Handle session.idle event - start countdown if todos remain
 */
export async function handleSessionIdle(
    client: OpencodeClient,
    sessionID: string,
    mainSessionID?: string
): Promise<void> {
    const state = getState(sessionID);
    const now = Date.now();

    // Rate limit: don't continue too frequently
    if (state.lastIdleTime && (now - state.lastIdleTime) < MIN_TIME_BETWEEN_CONTINUATIONS_MS) {
        log("[todo-continuation] Skipped: too soon since last check", { sessionID });
        return;
    }
    state.lastIdleTime = now;

    // Cancel any existing countdown
    cancelCountdown(sessionID);

    // Skip if not the main session (or if we're a background task session)
    if (mainSessionID && sessionID !== mainSessionID) {
        log("[todo-continuation] Skipped: not main session", { sessionID, mainSessionID });
        return;
    }

    // Skip if recovering from error
    if (isSessionRecovering(sessionID)) {
        log("[todo-continuation] Skipped: in recovery mode", { sessionID });
        return;
    }

    // Skip if background tasks are running
    if (hasRunningBackgroundTasks(sessionID)) {
        log("[todo-continuation] Skipped: background tasks running", { sessionID });
        return;
    }

    // Fetch todos
    let todos: Todo[] = [];
    try {
        const response = await client.session.todo({ path: { id: sessionID } });
        todos = parseTodos(response.data ?? response);
    } catch (error) {
        log("[todo-continuation] Failed to fetch todos", { sessionID, error });
        return;
    }

    // Check if there are incomplete todos
    if (!hasRemainingWork(todos)) {
        log("[todo-continuation] All todos complete", { sessionID });
        return;
    }

    const incompleteCount = getIncompleteCount(todos);
    const nextPending = getNextPending(todos);
    log("[todo-continuation] Starting countdown", {
        sessionID,
        incompleteCount,
        nextPending: nextPending?.id,
    });

    // Show initial countdown toast
    await showCountdownToast(client, COUNTDOWN_SECONDS, incompleteCount);
    state.countdownStartedAt = now;

    // Start countdown timer
    state.countdownTimer = setTimeout(async () => {
        cancelCountdown(sessionID);

        // Re-fetch todos to ensure they're still incomplete
        try {
            const freshResponse = await client.session.todo({ path: { id: sessionID } });
            const freshTodos = parseTodos(freshResponse.data ?? freshResponse);

            if (hasRemainingWork(freshTodos)) {
                await injectContinuation(client, sessionID, freshTodos);
            } else {
                log("[todo-continuation] Todos completed during countdown", { sessionID });
            }
        } catch {
            log("[todo-continuation] Failed to re-fetch todos for continuation", { sessionID });
        }
    }, COUNTDOWN_SECONDS * 1000);
}

/**
 * Handle user message - cancel countdown (user is interacting)
 */
export function handleUserMessage(sessionID: string): void {
    const state = getState(sessionID);

    // Cancel countdown if user sends a message
    if (state.countdownTimer) {
        log("[todo-continuation] Cancelled: user interaction", { sessionID });
        cancelCountdown(sessionID);
    }

    // Reset abort flag
    state.isAborting = false;
}

/**
 * Handle abort/cancel - prevent automatic continuation
 */
export function handleAbort(sessionID: string): void {
    const state = getState(sessionID);
    state.isAborting = true;
    cancelCountdown(sessionID);
    log("[todo-continuation] Marked as aborting", { sessionID });
}

/**
 * Clean up session state
 */
export function cleanupSession(sessionID: string): void {
    cancelCountdown(sessionID);
    sessionStates.delete(sessionID);
}

/**
 * Check if there's a pending continuation countdown
 */
export function hasPendingContinuation(sessionID: string): boolean {
    return !!sessionStates.get(sessionID)?.countdownTimer;
}
