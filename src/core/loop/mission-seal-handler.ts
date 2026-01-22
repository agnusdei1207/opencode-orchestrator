/**
 * Mission Seal Handler
 * 
 * Integrates Mission Seal detection with session events.
 * When session goes idle, checks for seal and either:
 * - Completes loop if seal detected
 * - Continues with next iteration if seal not detected
 */

import type { PluginInput } from "@opencode-ai/plugin";
import { presets } from "../../shared/index.js";
import { PART_TYPES, LOOP, TOAST_DURATION, STATUS_LABEL } from "../../shared/index.js";
import {
    readLoopState,
    clearLoopState,
    incrementIteration,
    detectSealInSession,
    generateMissionContinuationPrompt,
    generateSealedNotification,
    generateMaxIterationsNotification,
    type MissionLoopState,
} from "./mission-seal.js";
import { hasRemainingWork, getIncompleteCount } from "./stats.js";
import { isSessionRecovering } from "../recovery/session-recovery.js";
import { ParallelAgentManager } from "../agents/manager.js";
import { sendNotification } from "../notification/os-notify/notifier.js";
import { playSound } from "../notification/os-notify/sound-player.js";
import { detectPlatform, getDefaultSoundPath } from "../notification/os-notify/platform.js";

type OpencodeClient = PluginInput["client"];

// ============================================================================
// Configuration (from shared constants)
// ============================================================================

const COUNTDOWN_SECONDS = LOOP.COUNTDOWN_SECONDS;
const TOAST_DURATION_MS = TOAST_DURATION.EXTRA_SHORT;
const MIN_TIME_BETWEEN_CHECKS_MS = LOOP.MIN_TIME_BETWEEN_CHECKS_MS;

// ============================================================================
// State
// ============================================================================

interface HandlerState {
    countdownTimer?: ReturnType<typeof setTimeout>;
    lastCheckTime?: number;
    isAborting?: boolean;
}

const sessionStates = new Map<string, HandlerState>();

// ============================================================================
// Helpers
// ============================================================================

function getState(sessionID: string): HandlerState {
    let state = sessionStates.get(sessionID);
    if (!state) {
        state = {};
        sessionStates.set(sessionID, state);
    }
    return state;
}

function cancelCountdown(sessionID: string): void {
    const state = sessionStates.get(sessionID);
    if (state?.countdownTimer) {
        clearTimeout(state.countdownTimer);
        state.countdownTimer = undefined;
    }
}

function hasRunningBackgroundTasks(parentSessionID: string): boolean {
    try {
        const manager = ParallelAgentManager.getInstance();
        const tasks = manager.getTasksByParent(parentSessionID);
        return tasks.some(t => t.status === STATUS_LABEL.RUNNING);
    } catch {
        return false;
    }
}

// ============================================================================
// Toast Helpers
// ============================================================================

async function showCountdownToast(
    client: OpencodeClient,
    seconds: number,
    iteration: number,
    maxIterations: number
): Promise<void> {
    try {
        const tuiClient = client as unknown as {
            tui?: { showToast?: (opts: unknown) => Promise<void> }
        };
        if (tuiClient.tui?.showToast) {
            await tuiClient.tui.showToast({
                body: {
                    title: "🔄 Mission Loop",
                    message: `Continuing in ${seconds}s... (iteration ${iteration}/${maxIterations})`,
                    variant: "warning",
                    duration: TOAST_DURATION_MS,
                },
            });
        }
    } catch {
        // Toast failed, continue anyway
    }
}

async function showSealedToast(
    client: OpencodeClient,
    state: MissionLoopState
): Promise<void> {
    try {
        const tuiClient = client as unknown as {
            tui?: { showToast?: (opts: unknown) => Promise<void> }
        };
        if (tuiClient.tui?.showToast) {
            await tuiClient.tui.showToast({
                body: {
                    title: "🎖️ Mission Sealed!",
                    message: `Completed after ${state.iteration} iteration(s)`,
                    variant: "success",
                    duration: TOAST_DURATION.LONG,
                },
            });
        }
    } catch {
        // Toast failed
    }
}

async function showMaxIterationsToast(
    client: OpencodeClient,
    state: MissionLoopState
): Promise<void> {
    try {
        const tuiClient = client as unknown as {
            tui?: { showToast?: (opts: unknown) => Promise<void> }
        };
        if (tuiClient.tui?.showToast) {
            await tuiClient.tui.showToast({
                body: {
                    title: "⚠️ Mission Loop Stopped",
                    message: `Max iterations (${state.maxIterations}) reached`,
                    variant: "warning",
                    duration: TOAST_DURATION.LONG,
                },
            });
        }
    } catch {
        // Toast failed
    }
}

// ============================================================================
// Core Logic
// ============================================================================

/**
 * Inject continuation prompt to continue the mission
 */
async function injectContinuation(
    client: OpencodeClient,
    directory: string,
    sessionID: string,
    loopState: MissionLoopState
): Promise<void> {
    const handlerState = getState(sessionID);

    // Double-check conditions
    if (handlerState.isAborting) return;
    if (hasRunningBackgroundTasks(sessionID)) return;
    if (isSessionRecovering(sessionID)) return;

    // Check for seal one more time
    const sealDetected = await detectSealInSession(client, sessionID);
    if (sealDetected) {
        await handleSealDetected(client, directory, loopState);
        return;
    }

    // Generate and inject continuation prompt
    const prompt = generateMissionContinuationPrompt(loopState);

    try {
        await client.session.prompt({
            path: { id: sessionID },
            body: {
                parts: [{ type: PART_TYPES.TEXT, text: prompt }],
            },
        });
    } catch {
        // Injection failed, continue anyway
    }
}

/**
 * Handle when seal is detected - complete the loop
 */
async function handleSealDetected(
    client: OpencodeClient,
    directory: string,
    loopState: MissionLoopState
): Promise<void> {
    clearLoopState(directory);
    await showSealedToast(client, loopState);

    // Send OS-level notification when mission is sealed
    await sendMissionSealedNotification(loopState);
}

/**
 * Handle when max iterations reached
 */
async function handleMaxIterations(
    client: OpencodeClient,
    directory: string,
    loopState: MissionLoopState
): Promise<void> {
    clearLoopState(directory);
    await showMaxIterationsToast(client, loopState);
}

/**
 * Send OS-level notification when mission is sealed
 */
async function sendMissionSealedNotification(loopState: MissionLoopState): Promise<void> {
    try {
        const platform = detectPlatform();
        const soundPath = getDefaultSoundPath(platform);

        await sendNotification(
            platform,
            "🎖️ Mission Sealed!",
            `Task completed after ${loopState.iteration} iteration(s)`
        );

        if (soundPath) {
            await playSound(platform, soundPath);
        }
    } catch {
        // OS notification failed, continue anyway (toast was already shown)
    }
}

// ============================================================================
// Event Handler
// ============================================================================

/**
 * Handle session.idle event for mission seal loop
 */
export async function handleMissionSealIdle(
    client: OpencodeClient,
    directory: string,
    sessionID: string,
    mainSessionID?: string
): Promise<void> {
    const handlerState = getState(sessionID);
    const now = Date.now();

    // Rate limit
    if (handlerState.lastCheckTime &&
        (now - handlerState.lastCheckTime) < MIN_TIME_BETWEEN_CHECKS_MS) {
        return;
    }
    handlerState.lastCheckTime = now;

    // Cancel any pending countdown
    cancelCountdown(sessionID);

    // Skip if not main session
    if (mainSessionID && sessionID !== mainSessionID) {
        return;
    }

    // Skip if recovering
    if (isSessionRecovering(sessionID)) return;

    // Skip if background tasks running
    if (hasRunningBackgroundTasks(sessionID)) return;

    // Read loop state
    const loopState = readLoopState(directory);
    if (!loopState || !loopState.active) {
        // No active loop - let todo-continuation handle it
        return;
    }

    // Check if this is the right session
    if (loopState.sessionID !== sessionID) {
        return;
    }



    // Check for seal
    const sealDetected = await detectSealInSession(client, sessionID);

    if (sealDetected) {
        await handleSealDetected(client, directory, loopState);
        return;
    }

    // Check max iterations
    if (loopState.iteration >= loopState.maxIterations) {
        await handleMaxIterations(client, directory, loopState);
        return;
    }

    // Increment iteration
    const newState = incrementIteration(directory);
    if (!newState) return;

    // Show countdown toast
    await showCountdownToast(client, COUNTDOWN_SECONDS, newState.iteration, newState.maxIterations);

    // Start countdown timer
    handlerState.countdownTimer = setTimeout(async () => {
        cancelCountdown(sessionID);
        await injectContinuation(client, directory, sessionID, newState);
    }, COUNTDOWN_SECONDS * 1000);


}

/**
 * Handle user message - cancel countdown
 */
export function handleUserMessage(sessionID: string): void {
    const state = getState(sessionID);

    if (state.countdownTimer) {
        cancelCountdown(sessionID);
    }

    state.isAborting = false;
}

/**
 * Handle abort - prevent continuation
 */
export function handleAbort(sessionID: string): void {
    const state = getState(sessionID);
    state.isAborting = true;
    cancelCountdown(sessionID);
}

/**
 * Clean up session state
 */
export function cleanupSession(sessionID: string): void {
    cancelCountdown(sessionID);
    sessionStates.delete(sessionID);
}

/**
 * Check if there's a pending countdown
 * 
 * Utility function for debugging and testing continuation state.
 * Can be used to verify countdown status before injecting prompts.
 */
export function hasPendingContinuation(sessionID: string): boolean {
    return !!sessionStates.get(sessionID)?.countdownTimer;
}
