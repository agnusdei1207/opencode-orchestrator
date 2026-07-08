/**
 * Mission Loop - Persistent Execution System
 * 
 * Ensures the mission continues until all TODO items are complete.
 * This system moves away from explicit signaling (seals) and relies
 * strictly on file-based state verification.
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { log } from "../agents/logger.js";
import { PATHS, MISSION_CONTROL } from "../../shared/index.js";
import { RECOVERY_PRINCIPLE } from "../../shared/recovery/constants.js";
import { CONTINUE_INSTRUCTION, CLEANUP_INSTRUCTION } from "../../shared/constants/system-messages.js";
import type { MissionLoopState, MissionLoopOptions } from "../../shared/loop/types.js";
import { syncMissionMemory } from "../knowledge/mission-memory.js";
import { appendMissionLedgerEvent } from "./mission-ledger.js";

// ============================================================================
// Constants
// ============================================================================

/** State file path */
const STATE_FILE = MISSION_CONTROL.STATE_FILE;

/** Stagnation count at which the loop stops blind retries and escalates. */
const ESCALATION_STAGNATION_THRESHOLD = 5;

/** Default max iterations before giving up */
const DEFAULT_MAX_ITERATIONS = MISSION_CONTROL.DEFAULT_MAX_ITERATIONS;

type MissionContinuationContext = {
    verificationSummary?: string;
    continuationReason?: string;
    /** Files changed this mission with no verification recorded afterward. */
    unverifiedChanges?: number;
};

type MissionContinuationInput = string | MissionContinuationContext;

const UNKNOWN_STATUS = "unknown";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
    return value === undefined || typeof value === "string";
}

function isOptionalNonNegativeInteger(value: unknown): value is number | undefined {
    return value === undefined || isNonNegativeInteger(value);
}

function parseLoopState(value: unknown): MissionLoopState | null {
    if (!isRecord(value)) return null;
    if (typeof value.active !== "boolean") return null;
    if (!isNonNegativeInteger(value.iteration)) return null;
    if (!isPositiveInteger(value.maxIterations)) return null;
    if (typeof value.prompt !== "string") return null;
    if (!isOptionalString(value.objective)) return null;
    if (typeof value.sessionID !== "string") return null;
    if (typeof value.startedAt !== "string") return null;
    if (!isOptionalString(value.lastActivity)) return null;
    if (!isOptionalString(value.lastProgress)) return null;
    if (!isOptionalNonNegativeInteger(value.stagnationCount)) return null;
    if (!isOptionalString(value.lastVerificationSummary)) return null;
    if (!isOptionalString(value.lastContinuationReason)) return null;
    if (!isOptionalString(value.lastContinuationAt)) return null;

    const state: MissionLoopState = {
        active: value.active,
        iteration: value.iteration,
        maxIterations: value.maxIterations,
        prompt: value.prompt,
        sessionID: value.sessionID,
        startedAt: value.startedAt,
    };
    if (value.objective !== undefined) state.objective = value.objective;
    if (value.lastActivity !== undefined) state.lastActivity = value.lastActivity;
    if (value.lastProgress !== undefined) state.lastProgress = value.lastProgress;
    if (value.stagnationCount !== undefined) state.stagnationCount = value.stagnationCount;
    if (value.lastVerificationSummary !== undefined) state.lastVerificationSummary = value.lastVerificationSummary;
    if (value.lastContinuationReason !== undefined) state.lastContinuationReason = value.lastContinuationReason;
    if (value.lastContinuationAt !== undefined) state.lastContinuationAt = value.lastContinuationAt;
    return state;
}

// ============================================================================
// State Management
// ============================================================================

/**
 * Get state file path
 */
function getStateFilePath(directory: string): string {
    return join(directory, PATHS.OPENCODE, STATE_FILE);
}

/**
 * Read loop state from disk
 */
export function readLoopState(directory: string): MissionLoopState | null {
    const filePath = getStateFilePath(directory);

    if (!existsSync(filePath)) {
        return null;
    }

    try {
        const content = readFileSync(filePath, "utf-8");
        const state = parseLoopState(JSON.parse(content));
        if (!state) {
            log(`[${MISSION_CONTROL.LOG_SOURCE}] Ignoring invalid loop state`);
            return null;
        }
        return state;
    } catch (error) {
        log(`[${MISSION_CONTROL.LOG_SOURCE}] Failed to read state: ${error}`);
        return null;
    }
}

/**
 * Write loop state to disk
 */
export function writeLoopState(directory: string, state: MissionLoopState): boolean {
    const filePath = getStateFilePath(directory);
    const dirPath = join(directory, PATHS.OPENCODE);

    try {
        // Ensure .opencode directory exists
        if (!existsSync(dirPath)) {
            mkdirSync(dirPath, { recursive: true });
        }
        writeFileSync(filePath, JSON.stringify(state, null, 2), "utf-8");
        return true;
    } catch (error) {
        log(`[${MISSION_CONTROL.LOG_SOURCE}] Failed to write state: ${error}`);
        return false;
    }
}

/**
 * Clear loop state (delete file)
 */
export function clearLoopState(directory: string): boolean {
    const filePath = getStateFilePath(directory);

    if (!existsSync(filePath)) {
        return false;
    }

    try {
        unlinkSync(filePath);
        return true;
    } catch (error) {
        log(`[${MISSION_CONTROL.LOG_SOURCE}] Failed to clear state: ${error}`);
        return false;
    }
}

/**
 * Increment iteration counter
 */
export function incrementIteration(directory: string): MissionLoopState | null {
    const state = readLoopState(directory);
    if (!state) return null;

    state.iteration += 1;
    state.lastActivity = new Date().toISOString();

    if (writeLoopState(directory, state)) {
        return state;
    }
    return null;
}

function deriveObjective(prompt: string): string {
    const firstLine = prompt.split(/\r?\n/).find(line => line.trim().length > 0);
    return firstLine?.trim() || prompt.trim() || "Continue the active mission";
}

// ============================================================================
// Loop Control
// ============================================================================

/**
 * Start a mission loop
 */
export function startMissionLoop(
    directory: string,
    sessionID: string,
    prompt: string,
    options: MissionLoopOptions = {}
): boolean {
    const state: MissionLoopState = {
        active: true,
        iteration: 1,
        maxIterations: options.maxIterations ?? DEFAULT_MAX_ITERATIONS,
        prompt,
        objective: deriveObjective(prompt),
        sessionID,
        startedAt: new Date().toISOString(),
    };

    const success = writeLoopState(directory, state);

    if (success) {
        appendMissionLedgerEvent(directory, {
            type: "mission_started",
            sessionID,
            iteration: state.iteration,
            objective: state.objective,
            summary: "Mission loop started",
        });
        syncMissionMemory(directory, state);
        // TerminalMonitor.getInstance().start();
        log(`[${MISSION_CONTROL.LOG_SOURCE}] Loop started`, {
            sessionID,
            maxIterations: state.maxIterations,
        });
    }

    return success;
}

/**
 * Cancel an active mission loop
 */
export function cancelMissionLoop(directory: string, sessionID: string): boolean {
    const state = readLoopState(directory);

    if (!state || state.sessionID !== sessionID) {
        return false;
    }

    const success = clearLoopState(directory);

    if (success) {
        const cancelledState = {
            ...state,
            active: false,
            lastContinuationReason: "cancelled",
        };
        appendMissionLedgerEvent(directory, {
            type: "mission_cancelled",
            sessionID,
            iteration: state.iteration,
            objective: state.objective,
            reason: "cancelled",
        });
        syncMissionMemory(directory, cancelledState);
        log(`[${MISSION_CONTROL.LOG_SOURCE}] Loop cancelled`, { sessionID, iteration: state.iteration });
    }

    return success;
}

/**
 * Check if loop is active for session
 */
export function isLoopActive(directory: string, sessionID: string): boolean {
    const state = readLoopState(directory);
    return state?.active === true && state?.sessionID === sessionID;
}

// ============================================================================
// Continuation Prompt
// ============================================================================

/**
 * Generate continuation prompt for mission loop
 */
export function generateMissionContinuationPrompt(state: MissionLoopState, input?: MissionContinuationInput): string {
    const context = normalizeContinuationContext(state, input);

    let prompt = `${CONTINUE_INSTRUCTION}

<mission_loop iteration="${state.iteration}" max="${state.maxIterations}">
MISSION NOT COMPLETE

Objective:
${context.objective}

Runtime status:
- progress: ${context.progress}
- verification: ${context.verification}
- stagnation: ${context.stagnation}
- continuation reason: ${context.reason}

Next action:
1. Read the current TODO, checklist, and sync issue state.
2. Execute or delegate only the next unblocked work.
3. Verify the result with real file reads, build commands, tests, or tool output.
4. Finish only when mission verification passes.

Completion rule:
Do not declare success while TODO/checklist/sync verification is still failing.
Before declaring done, briefly self-account: (1) scope fit vs the objective,
(2) what verification ran, (3) any residual risk or follow-on wiring.
</mission_loop>`;

    if (context.escalate) {
        prompt += `\n\n<escalation reason="repeated_stagnation">
Progress has stalled across ${context.stagnation}. Stop blind retries.
Follow ${RECOVERY_PRINCIPLE}
1. DECOMPOSE the blocked step into smaller, independently verifiable pieces.
2. RE-PLAN with a different approach if decomposition does not unblock it.
3. If still blocked, summarize the exact blocker and ASK the user for direction.
</escalation>`;
    }

    if (context.unverifiedChanges > 0) {
        prompt += `\n\n<wiring_gate>
${context.unverifiedChanges} changed file(s) this mission have no verification evidence yet.
Run the project's tests/build/lint over the changed surface and cite the result before declaring done.
</wiring_gate>`;
    }

    // Inject Maintenance Instruction based on iteration
    if (state.iteration > 1) {
        prompt += "\n" + CLEANUP_INSTRUCTION.replace("%ITER%", state.iteration.toString());
    }

    return prompt;
}

function normalizeContinuationContext(
    state: MissionLoopState,
    input?: MissionContinuationInput,
) {
    const verificationSummary = typeof input === "string" ? input : input?.verificationSummary;
    const continuationReason = typeof input === "string" ? undefined : input?.continuationReason;
    const unverifiedChanges = typeof input === "string" ? 0 : input?.unverifiedChanges ?? 0;
    const stagnationCount = state.stagnationCount ?? 0;
    return {
        objective: state.objective || deriveObjective(state.prompt),
        progress: state.lastProgress ?? UNKNOWN_STATUS,
        verification: verificationSummary ?? state.lastVerificationSummary ?? UNKNOWN_STATUS,
        reason: continuationReason ?? state.lastContinuationReason ?? "verification_failed",
        stagnation: stagnationCount > 0 ? `${stagnationCount} unchanged check(s)` : "not detected",
        unverifiedChanges,
        escalate: stagnationCount >= ESCALATION_STAGNATION_THRESHOLD,
    };
}
