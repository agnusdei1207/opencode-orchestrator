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
import type { MissionLoopState } from "../../shared/loop/types.js";
import { STAGNATION_INTERVENTION } from "../../shared/constants/system-messages.js";
import { LOOP, TOAST_DURATION, STATUS_LABEL, TOAST_VARIANTS, MISSION_CONTROL, type ToastVariant, type VerificationResult } from "../../shared/index.js";
import { isSessionRecovering } from "../recovery/session-recovery.js";
import { ParallelAgentManager } from "../agents/manager.js";
import { sendNotification } from "../notification/os-notify/notifier.js";
import { playSound } from "../notification/os-notify/sound-player.js";
import { detectPlatform, getDefaultSoundPath } from "../notification/os-notify/platform.js";
import { verifyMissionCompletion, buildVerificationSummary } from "./verification.js";
import { syncMissionMemory } from "../knowledge/mission-memory.js";
import { appendMissionLedgerEvent } from "./mission-ledger.js";
import { createSessionStateStore, type SessionState } from "./session-state-store.js";
import { getUnverifiedFiles, clearEvidence } from "./evidence.js";
import { trackProgress, resetProgress, isStagnant, markInjectionPerformed, DEFAULT_STAGNATION_THRESHOLD } from "./progress-tracker.js";
import { armCompactionGuard, isCompactionSafe, clearCompactionState } from "./compaction-guard.js";
import { isCircuitOpen, tripOutputCircuit, clearCircuitState } from "./circuit-breaker.js";
import { isSessionBusy, isKnownBusy } from "../session/activity.js";
import { deactivateMissionState } from "../orchestrator/session-manager.js";
import { syntheticTextPart } from "../session/injection.js";
import {
    applyContinuationMetadata,
    getVerificationRemainingCount,
} from "./mission-continuation.js";

type OpencodeClient = PluginInput["client"];

const sessionStateStore = createSessionStateStore();

interface ContinuationInjectionRequest {
    client: OpencodeClient;
    directory: string;
    sessionID: string;
    loopState: MissionLoopState;
    scheduledAt: number;
    customPrompt?: string;
}

interface ToastRequest {
    title: string;
    message: string;
    variant: ToastVariant;
    duration: number;
}

interface PreparedContinuation {
    loopState: MissionLoopState;
    scheduledAt: number;
    stagnant: boolean;
}

interface PreparedPrompt {
    text: string;
    summary: string;
    reason?: string;
}

async function showToastSafely(client: OpencodeClient, request: ToastRequest): Promise<void> {
    try {
        if (client.tui?.showToast) {
            await client.tui.showToast({
                body: request,
            });
        }
    } catch (err) {
        log("[mission-loop-handler] Toast failed", { error: err });
    }
}

function hasRunningBackgroundTasks(parentSessionID: string): boolean {
    try {
        const manager = ParallelAgentManager.getInstance();
        const tasks = manager.getTasksByParent(parentSessionID);
        return tasks.some(t => t.status === STATUS_LABEL.RUNNING || t.status === STATUS_LABEL.PENDING);
    } catch (err) {
        log("[mission-loop-handler] Failed to check background tasks", { sessionID: parentSessionID, error: err });
        return true;
    }
}

async function showCountdownToast(
    client: OpencodeClient,
    seconds: number,
    iteration: number,
    maxIterations: number
): Promise<void> {
    await showToastSafely(client, {
        title: "🔄 Mission Loop",
        message: `Continuing in ${seconds}s... (iteration ${iteration}/${maxIterations})`,
        variant: TOAST_VARIANTS.WARNING,
        duration: TOAST_DURATION.EXTRA_SHORT,
    });
}

async function showCompletedToast(
    client: OpencodeClient,
    state: MissionLoopState
): Promise<void> {
    await showToastSafely(client, {
        title: "🎖️ Mission Complete!",
        message: `Verified and finished after ${state.iteration} iteration(s)`,
        variant: TOAST_VARIANTS.SUCCESS,
        duration: TOAST_DURATION.LONG,
    });
}

function canBeginInjection(
    request: ContinuationInjectionRequest,
    state: SessionState | undefined,
): state is SessionState {
    const { sessionID, scheduledAt } = request;
    if (!state || state.isAborting || state.countdownStartedAt !== scheduledAt) return false;
    if (hasRunningBackgroundTasks(sessionID)) return false;
    if (isSessionRecovering(sessionID)) return false;
    if (isCircuitOpen(sessionID)) {
        log(`[mission-loop-handler] Skipped: circuit breaker open`, { sessionID });
        return false;
    }

    if (!isCompactionSafe(sessionID, scheduledAt)) {
        log(`[mission-loop-handler] Skipped: post-compaction unsafe`, { sessionID, scheduledAt });
        return false;
    }
    return true;
}

function isInjectionCurrent(request: ContinuationInjectionRequest, state: SessionState): boolean {
    const { directory, sessionID, loopState, scheduledAt } = request;
    if (state.isAborting || state.countdownStartedAt !== scheduledAt) return false;
    if (!isCurrentMission(directory, loopState)) return false;
    return isCompactionSafe(sessionID, scheduledAt) && !hasRunningBackgroundTasks(sessionID);
}

function prepareContinuationPrompt(
    request: ContinuationInjectionRequest,
    verification: VerificationResult,
): PreparedPrompt {
    const { sessionID, loopState, customPrompt } = request;
    const summary = buildVerificationSummary(verification);
    const continuationReason = customPrompt ? "stagnation_intervention" : loopState.lastContinuationReason;
    const generated = generateMissionContinuationPrompt(loopState, {
        verificationSummary: summary,
        continuationReason,
        unverifiedFiles: getUnverifiedFiles(sessionID),
    });
    const text = customPrompt ? `${customPrompt}\n\n${generated}` : generated;
    return { text, summary, reason: continuationReason };
}

async function sendContinuationPrompt(
    request: ContinuationInjectionRequest,
    prepared: PreparedPrompt,
): Promise<void> {
    const { client, directory, sessionID, loopState } = request;
    try {
        await client.session.prompt({
            path: { id: sessionID },
            body: {
                parts: [syntheticTextPart(prepared.text)],
            },
        });
        appendMissionLedgerEvent(directory, {
            type: "prompt_injected",
            sessionID,
            iteration: loopState.iteration,
            objective: loopState.objective,
            summary: prepared.summary,
            reason: prepared.reason,
        });
        syncMissionMemory(directory, loopState);
        markInjectionPerformed(sessionID);
    } catch (err) {
        log("[mission-loop-handler] Failed to inject continuation prompt", { sessionID, error: err });
    }
}

async function injectContinuation(request: ContinuationInjectionRequest): Promise<void> {
    const { client, directory, sessionID, loopState } = request;
    const state = sessionStateStore.getExistingState(sessionID);
    if (!canBeginInjection(request, state)) return;

    if (await isSessionBusy(client, sessionID)) {
        log(`[mission-loop-handler] Skipped: session is busy`, { sessionID });
        return;
    }
    if (!isInjectionCurrent(request, state)) return;

    const verification = verifyMissionCompletion(directory);
    if (verification.passed) {
        await handleMissionComplete(client, directory, loopState);
        return;
    }
    await sendContinuationPrompt(request, prepareContinuationPrompt(request, verification));
}

function isCurrentMission(directory: string, expected: MissionLoopState): boolean {
    const current = readLoopState(directory);
    return current?.active === true && current.sessionID === expected.sessionID
        && current.startedAt === expected.startedAt && current.prompt === expected.prompt;
}

async function handleMissionComplete(
    client: OpencodeClient,
    directory: string,
    loopState: MissionLoopState
): Promise<void> {
    if (!clearLoopState(directory)) return;
    const completedState = {
        ...loopState,
        active: false,
        lastVerificationSummary: "Mission verification passed",
        lastContinuationReason: "mission_completed",
    };
    appendMissionLedgerEvent(directory, {
        type: "mission_completed",
        sessionID: loopState.sessionID,
        iteration: loopState.iteration,
        objective: loopState.objective,
        summary: "Mission verification passed",
    });
    syncMissionMemory(directory, completedState);
    deactivateMissionState(loopState.sessionID);
    await showCompletedToast(client, loopState);
    await sendMissionCompleteNotification(loopState);
    sessionStateStore.cleanup(loopState.sessionID);
    clearCompactionState(loopState.sessionID);
    clearCircuitState(loopState.sessionID);
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
    } catch (err) {
        log("[mission-loop-handler] Notification failed", { sessionID: loopState.sessionID, error: err });
    }
}

function beginIdleCheck(
    sessionID: string,
    mainSessionID: string | undefined,
    now: number,
): SessionState | undefined {
    const state = sessionStateStore.getState(sessionID);
    if (state.isAborting) return undefined;
    if (state.lastCheckTime && now - state.lastCheckTime < LOOP.MIN_TIME_BETWEEN_CHECKS_MS) {
        return undefined;
    }

    state.lastCheckTime = now;
    sessionStateStore.cancelCountdown(sessionID);
    if (mainSessionID && sessionID !== mainSessionID) return undefined;
    if (isSessionRecovering(sessionID)) return undefined;
    if (hasRunningBackgroundTasks(sessionID)) return undefined;
    if (isKnownBusy(sessionID)) return undefined;
    return state;
}

function readOwnedMission(directory: string, sessionID: string): MissionLoopState | undefined {
    const loopState = readLoopState(directory);
    if (!loopState?.active || loopState.sessionID !== sessionID) return undefined;
    return loopState;
}

function isIdleCheckCurrent(
    state: SessionState,
    directory: string,
    loopState: MissionLoopState,
): boolean {
    if (state.isAborting) return false;
    if (sessionStateStore.getExistingState(loopState.sessionID) !== state) return false;
    return isCurrentMission(directory, loopState);
}

function recordCircuitOpen(
    directory: string,
    loopState: MissionLoopState,
    verificationSummary: string,
): void {
    appendMissionLedgerEvent(directory, {
        type: "circuit_open",
        sessionID: loopState.sessionID,
        iteration: loopState.iteration,
        objective: loopState.objective,
        summary: verificationSummary,
        reason: "stagnation_threshold",
    });
    syncMissionMemory(directory, {
        ...loopState,
        lastVerificationSummary: verificationSummary,
        lastContinuationReason: "circuit_open",
    });
    log(`[${MISSION_CONTROL.LOG_SOURCE}-handler] Circuit breaker tripped for ${loopState.sessionID}`);
}

function trackMissionProgress(sessionID: string, verification: VerificationResult): boolean {
    const remaining = getVerificationRemainingCount(verification);
    const progress = trackProgress(sessionID, remaining);
    if (progress.hasProgressed) {
        log(`[${MISSION_CONTROL.LOG_SOURCE}-handler] Progress made`, {
            sessionID,
            source: progress.progressSource,
        });
    }
    return isStagnant(sessionID, DEFAULT_STAGNATION_THRESHOLD);
}

function recordContinuationScheduled(
    directory: string,
    loopState: MissionLoopState,
    verificationSummary: string,
): void {
    appendMissionLedgerEvent(directory, {
        type: "verification_failed",
        sessionID: loopState.sessionID,
        iteration: loopState.iteration,
        objective: loopState.objective,
        summary: verificationSummary,
    });
    appendMissionLedgerEvent(directory, {
        type: "continuation_scheduled",
        sessionID: loopState.sessionID,
        iteration: loopState.iteration,
        objective: loopState.objective,
        summary: verificationSummary,
        reason: loopState.lastContinuationReason,
    });
    syncMissionMemory(directory, loopState);
}

function prepareContinuation(
    directory: string,
    sessionID: string,
    verification: VerificationResult,
): PreparedContinuation | undefined {
    const verificationSummary = buildVerificationSummary(verification);
    const stagnant = trackMissionProgress(sessionID, verification);
    const incrementedState = incrementIteration(directory);
    if (!incrementedState) return undefined;

    const scheduledAt = Date.now();
    const loopState = applyContinuationMetadata(incrementedState, {
        progress: verificationSummary,
        verificationSummary,
        stagnant,
        scheduledAt,
    });
    writeLoopState(directory, loopState);
    recordContinuationScheduled(directory, loopState, verificationSummary);
    return { loopState, scheduledAt, stagnant };
}

async function runScheduledContinuation(
    request: ContinuationInjectionRequest,
    state: SessionState,
): Promise<void> {
    state.countdownTimer = undefined;
    try {
        await injectContinuation(request);
    } finally {
        if (state.countdownStartedAt === request.scheduledAt) {
            sessionStateStore.cancelCountdown(request.sessionID);
        }
    }
}

async function scheduleContinuation(
    client: OpencodeClient,
    directory: string,
    state: SessionState,
    prepared: PreparedContinuation,
): Promise<void> {
    const { loopState, scheduledAt, stagnant } = prepared;
    state.countdownStartedAt = scheduledAt;
    await showCountdownToast(
        client,
        MISSION_CONTROL.DEFAULT_COUNTDOWN_SECONDS,
        loopState.iteration,
        loopState.maxIterations,
    );
    if (sessionStateStore.getExistingState(loopState.sessionID) !== state) return;
    if (state.countdownStartedAt !== scheduledAt) return;

    const request: ContinuationInjectionRequest = {
        client,
        directory,
        sessionID: loopState.sessionID,
        loopState,
        scheduledAt,
        customPrompt: stagnant ? STAGNATION_INTERVENTION : undefined,
    };
    state.countdownTimer = setTimeout(
        () => runScheduledContinuation(request, state),
        MISSION_CONTROL.DEFAULT_COUNTDOWN_SECONDS * 1000,
    );
}

export async function handleMissionIdle(
    client: OpencodeClient,
    directory: string,
    sessionID: string,
    mainSessionID?: string
): Promise<void> {
    const state = beginIdleCheck(sessionID, mainSessionID, Date.now());
    if (!state) return;
    const loopState = readOwnedMission(directory, sessionID);
    if (!loopState) return;
    if (await isSessionBusy(client, sessionID)) return;
    if (!isIdleCheckCurrent(state, directory, loopState)) return;
    if (hasRunningBackgroundTasks(sessionID)) return;

    const verification = verifyMissionCompletion(directory);
    if (verification.passed) {
        log(`[${MISSION_CONTROL.LOG_SOURCE}-handler] Verification passed for ${sessionID}. Completion confirmed.`);
        await handleMissionComplete(client, directory, loopState);
        return;
    }

    if (tripOutputCircuit(sessionID)) {
        const verificationSummary = buildVerificationSummary(verification);
        recordCircuitOpen(directory, loopState, verificationSummary);
        return;
    }

    const prepared = prepareContinuation(directory, sessionID, verification);
    if (!prepared) return;
    await scheduleContinuation(client, directory, state, prepared);
}

export function handleUserMessage(sessionID: string): void {
    const state = sessionStateStore.getState(sessionID);
    state.isAborting = false;
    sessionStateStore.cancelCountdown(sessionID);
}

export function handleAbort(sessionID: string): void {
    const state = sessionStateStore.getState(sessionID);
    state.isAborting = true;
    sessionStateStore.cancelCountdown(sessionID);
}

/**
 * The session started working again while a continuation countdown was pending.
 * Drop the countdown: the model is already doing the thing we were about to ask
 * it to do, and injecting now would interrupt it mid-turn.
 */
export function handleSessionBusy(sessionID: string): void {
    sessionStateStore.cancelCountdown(sessionID);
}

/**
 * Release this handler's per-session state.
 *
 * Session activity is deliberately NOT cleared here: it is owned by the session
 * layer and released once, on `session.deleted`, so that clearing one loop's
 * state cannot blind the other to a session that is still working.
 */
export function cleanupSession(sessionID: string): void {
    sessionStateStore.cleanup(sessionID);
    clearCompactionState(sessionID);
    clearCircuitState(sessionID);
    resetProgress(sessionID);
    clearEvidence(sessionID);
}

/**
 * Stop this handler's session-state store, for plugin shutdown. The store owns
 * a prune interval created at module load, which nothing else stops.
 */
export function shutdownMissionLoopHandler(): void {
    sessionStateStore.shutdown();
}

export function handleSessionCompacted(sessionID: string): void {
    armCompactionGuard(sessionID, Date.now());
    sessionStateStore.cancelCountdown(sessionID);
}
