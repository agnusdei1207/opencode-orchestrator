/**
 * Mission Loop Handler
 * 
 * Monitors session events and ensures the mission loop continues
 * until all verification requirements are met.
 * 
 * Integrates: ProgressTracker, SessionStateStore, CompactionGuard, CircuitBreaker
 */

import type { PluginInput } from "@opencode-ai/plugin";
import { log } from "../agents/logger.js";

import {
    readLoopState,
    clearLoopState,
    incrementIteration,
    writeLoopState,
    generateMissionContinuationPrompt,
} from "./mission-loop.js";
import type { MissionLoopState } from "../../shared/loop/interfaces/mission-loop.js";
import { STAGNATION_INTERVENTION } from "../../shared/constants/system-messages.js";
import { PART_TYPES, LOOP, TOAST_DURATION, STATUS_LABEL, TOAST_VARIANTS, MISSION_CONTROL } from "../../shared/index.js";
import { isSessionRecovering } from "../recovery/session-recovery.js";
import { ParallelAgentManager } from "../agents/manager.js";
import { sendNotification } from "../notification/os-notify/notifier.js";
import { playSound } from "../notification/os-notify/sound-player.js";
import { detectPlatform, getDefaultSoundPath } from "../notification/os-notify/platform.js";
import { verifyMissionCompletion, buildVerificationSummary } from "./verification.js";
import { createSessionStateStore } from "./session-state-store.js";
import { trackProgress, resetProgress, isStagnant, markInjectionPerformed, DEFAULT_STAGNATION_THRESHOLD } from "./progress-tracker.js";
import { armCompactionGuard, disarmCompactionGuard, isCompactionSafe, clearCompactionState } from "./compaction-guard.js";
import { isCircuitOpen, shouldTripCircuit, clearCircuitState } from "./circuit-breaker.js";

type OpencodeClient = PluginInput["client"];

const sessionStateStore = createSessionStateStore();

function hasRunningBackgroundTasks(parentSessionID: string): boolean {
    try {
        const manager = ParallelAgentManager.getInstance();
        const tasks = manager.getTasksByParent(parentSessionID);
        return tasks.some(t => t.status === STATUS_LABEL.RUNNING);
    } catch {
        return false;
    }
}

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

async function injectContinuation(
    client: OpencodeClient,
    directory: string,
    sessionID: string,
    loopState: MissionLoopState,
    customPrompt?: string
): Promise<void> {
    const state = sessionStateStore.getState(sessionID);

    if (state.isAborting) return;
    if (hasRunningBackgroundTasks(sessionID)) return;
    if (isSessionRecovering(sessionID)) return;
    if (isCircuitOpen(sessionID)) {
        log(`[mission-loop-handler] Skipped: circuit breaker open`, { sessionID });
        return;
    }

    const verification = verifyMissionCompletion(directory);
    if (verification.passed) {
        await handleMissionComplete(client, directory, loopState);
        return;
    }

    const summary = buildVerificationSummary(verification);
    let prompt = generateMissionContinuationPrompt(loopState, summary);

    if (customPrompt) {
        prompt = `${customPrompt}\n\n${prompt}`;
    }

    try {
        client.session.prompt({
            path: { id: sessionID },
            body: {
                parts: [{ type: PART_TYPES.TEXT, text: prompt }],
            },
        }).catch(error => {
            log("[mission-loop-handler] Failed to inject continuation prompt", { sessionID, error });
        });

        markInjectionPerformed(sessionID);
    } catch {
        // Injection failed
    }
}

async function handleMissionComplete(
    client: OpencodeClient,
    directory: string,
    loopState: MissionLoopState
): Promise<void> {
    const cleared = clearLoopState(directory);
    if (cleared) {
        await showCompletedToast(client, loopState);
        await sendMissionCompleteNotification(loopState);
        sessionStateStore.cleanup(loopState.sessionID);
        clearCompactionState(loopState.sessionID);
        clearCircuitState(loopState.sessionID);
    }
}

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

export async function handleMissionIdle(
    client: OpencodeClient,
    directory: string,
    sessionID: string,
    mainSessionID?: string
): Promise<void> {
    const state = sessionStateStore.getState(sessionID);
    const now = Date.now();

    if (state.lastCheckTime &&
        (now - state.lastCheckTime) < LOOP.MIN_TIME_BETWEEN_CHECKS_MS) {
        return;
    }
    state.lastCheckTime = now;

    sessionStateStore.cancelCountdown(sessionID);

    if (mainSessionID && sessionID !== mainSessionID) {
        return;
    }

    if (isSessionRecovering(sessionID)) return;
    if (hasRunningBackgroundTasks(sessionID)) return;

    const loopState = readLoopState(directory);
    if (!loopState || !loopState.active) {
        return;
    }

    if (loopState.sessionID !== sessionID) {
        return;
    }

    const verification = verifyMissionCompletion(directory);

    if (verification.passed) {
        log(`[${MISSION_CONTROL.LOG_SOURCE}-handler] Verification passed for ${sessionID}. Completion confirmed.`);
        await handleMissionComplete(client, directory, loopState);
        return;
    }

    if (shouldTripCircuit(sessionID)) {
        log(`[${MISSION_CONTROL.LOG_SOURCE}-handler] Circuit breaker tripped for ${sessionID}`);
        return;
    }

    const currentProgress = verification.todoProgress;
    const progressResult = trackProgress(sessionID, verification.todoIncomplete);

    if (progressResult.hasProgressed) {
        log(`[${MISSION_CONTROL.LOG_SOURCE}-handler] Progress made`, {
            sessionID,
            source: progressResult.progressSource,
        });
    }

    const stagnant = isStagnant(sessionID, DEFAULT_STAGNATION_THRESHOLD);

    const newState = incrementIteration(directory);
    if (!newState) return;

    newState.lastProgress = currentProgress;
    writeLoopState(directory, newState);

    await showCountdownToast(client, MISSION_CONTROL.DEFAULT_COUNTDOWN_SECONDS, newState.iteration, newState.maxIterations);

    state.countdownTimer = setTimeout(async () => {
        sessionStateStore.cancelCountdown(sessionID);
        await injectContinuation(client, directory, sessionID, newState, stagnant ? STAGNATION_INTERVENTION : undefined);
    }, MISSION_CONTROL.DEFAULT_COUNTDOWN_SECONDS * 1000);
}

export function handleUserMessage(sessionID: string): void {
    sessionStateStore.cancelCountdown(sessionID);
}

export function handleAbort(sessionID: string): void {
    const state = sessionStateStore.getState(sessionID);
    state.isAborting = true;
    sessionStateStore.cancelCountdown(sessionID);
}

export function cleanupSession(sessionID: string): void {
    sessionStateStore.cleanup(sessionID);
    clearCompactionState(sessionID);
    clearCircuitState(sessionID);
    resetProgress(sessionID);
}

export function handleSessionCompacted(sessionID: string): void {
    armCompactionGuard(sessionID, Date.now());
    sessionStateStore.cancelCountdown(sessionID);
}
