/**
 * Mission Loop Handler
 * 
 * Monitors session events and ensures the mission loop continues
 * until all verification requirements are met.
 */

import type { PluginInput } from "@opencode-ai/plugin";
import { log } from "../agents/logger.js";

import {
    readLoopState,
    clearLoopState,
    incrementIteration,
    generateMissionContinuationPrompt,
    type MissionLoopState,
} from "./mission-loop.js";
import { PART_TYPES, LOOP, TOAST_DURATION, STATUS_LABEL, TOAST_VARIANTS, MISSION_CONTROL } from "../../shared/index.js";
import { isSessionRecovering } from "../recovery/session-recovery.js";
import { ParallelAgentManager } from "../agents/manager.js";
import { sendNotification } from "../notification/os-notify/notifier.js";
import { playSound } from "../notification/os-notify/sound-player.js";
import { detectPlatform, getDefaultSoundPath } from "../notification/os-notify/platform.js";
import { verifyMissionCompletion, buildVerificationFailurePrompt, buildVerificationSummary } from "./verification.js";


type OpencodeClient = PluginInput["client"];

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
                    variant: TOAST_VARIANTS.WARNING,
                    duration: TOAST_DURATION.EXTRA_SHORT,
                },
            });
        }
    } catch {
        // Toast failed
    }
}

async function showCompletedToast(
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
                    title: "🎖️ Mission Complete!",
                    message: `Verified and finished after ${state.iteration} iteration(s)`,
                    variant: TOAST_VARIANTS.SUCCESS,
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

    // Verify completion one last time
    const verification = verifyMissionCompletion(directory);
    if (verification.passed) {
        await handleMissionComplete(client, directory, loopState);
        return;
    }

    // Generate and inject continuation prompt with summary
    const summary = buildVerificationSummary(verification);
    const prompt = generateMissionContinuationPrompt(loopState, summary);

    try {
        await client.session.prompt({
            path: { id: sessionID },
            body: {
                parts: [{ type: PART_TYPES.TEXT, text: prompt }],
            },
        });
    } catch {
        // Injection failed
    }
}

/**
 * Handle mission complete
 */
async function handleMissionComplete(
    client: OpencodeClient,
    directory: string,
    loopState: MissionLoopState
): Promise<void> {
    const cleared = clearLoopState(directory);
    if (cleared) {
        await showCompletedToast(client, loopState);
        await sendMissionCompleteNotification(loopState);
    }
}

/**
 * Send OS-level notification when mission is complete
 */
async function sendMissionCompleteNotification(loopState: MissionLoopState): Promise<void> {
    try {
        const platform = detectPlatform();
        const soundPath = getDefaultSoundPath(platform);

        await sendNotification(
            platform,
            "🎖️ Mission Complete!",
            `All tasks verified after ${loopState.iteration} iteration(s)`
        );

        if (soundPath) {
            await playSound(platform, soundPath);
        }
    } catch {
        // Notification failed
    }
}

// ============================================================================
// Event Handler
// ============================================================================

/**
 * Handle session.idle event for mission loop
 */
export async function handleMissionIdle(
    client: OpencodeClient,
    directory: string,
    sessionID: string,
    mainSessionID?: string
): Promise<void> {
    const handlerState = getState(sessionID);
    const now = Date.now();

    // Rate limit
    if (handlerState.lastCheckTime &&
        (now - handlerState.lastCheckTime) < LOOP.MIN_TIME_BETWEEN_CHECKS_MS) {
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
        return;
    }

    // Check if this is the right session
    if (loopState.sessionID !== sessionID) {
        return;
    }

    // VERIFICATION GATE: Check if work is truly done
    const verification = verifyMissionCompletion(directory);

    if (verification.passed) {
        log(`[${MISSION_CONTROL.LOG_SOURCE}-handler] Verification passed for ${sessionID}. Completion confirmed.`);
        await handleMissionComplete(client, directory, loopState);
        return;
    }

    // Work remains - continue the loop
    log(`[${MISSION_CONTROL.LOG_SOURCE}-handler] Work remains for ${sessionID}, continuing...`, {
        todo: verification.todoProgress,
        checklist: verification.checklistProgress
    });

    // Handle max iterations exhaustion
    if (loopState.iteration >= loopState.maxIterations) {
        log(`[${MISSION_CONTROL.LOG_SOURCE}-handler] Max iterations (${loopState.maxIterations}) reached but verification failed. Forced continuation enabled.`);
        // In "Infinite Loop" mode, we might just keep going or notify
    }

    // Increment iteration
    const newState = incrementIteration(directory);
    if (!newState) return;

    // Show countdown toast
    await showCountdownToast(client, MISSION_CONTROL.DEFAULT_COUNTDOWN_SECONDS, newState.iteration, newState.maxIterations);

    // Start countdown timer
    handlerState.countdownTimer = setTimeout(async () => {
        cancelCountdown(sessionID);
        await injectContinuation(client, directory, sessionID, newState);
    }, MISSION_CONTROL.DEFAULT_COUNTDOWN_SECONDS * 1000);
}

/**
 * Handle user message - cancel countdown
 */
export function handleUserMessage(sessionID: string): void {
    const state = getState(sessionID);
    if (state.countdownTimer) {
        cancelCountdown(sessionID);
    }
}

/**
 * Handle abort
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
