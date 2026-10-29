/**
 * Mission Loop - Persistent Execution System
 * 
 * Ensures the mission continues until all TODO items are complete.
 * This system moves away from explicit signaling (seals) and relies
 * strictly on file-based state verification.
 */

import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { log } from "../../shared/logger.js";
import { PATHS, MISSION_CONTROL } from "../../shared/index.js";
import { RECOVERY_PRINCIPLE } from "../../shared/recovery/constants.js";
import { CONTINUE_INSTRUCTION, CLEANUP_INSTRUCTION } from "../../shared/constants/system-messages.js";
import type { MissionLoopState, MissionLoopOptions } from "../../shared/loop/types.js";
import { syncMissionMemory } from "../knowledge/mission-memory.js";
import { atomicWrite } from "../knowledge/mission-note.js";
import { appendMissionLedgerEvent } from "./mission-ledger.js";
import { isRecord } from "../../shared/core/guards.js";

// ============================================================================
// Constants
// ============================================================================

/** State file path */
const STATE_FILE = MISSION_CONTROL.STATE_FILE;

/** Stagnation count at which the loop stops blind retries and escalates. */
const ESCALATION_STAGNATION_THRESHOLD = 5;

type MissionContinuationContext = {
    verificationSummary?: string;
    continuationReason?: string;
    /** Files changed this mission with no recognized verification afterward. */
    unverifiedFiles?: string[];
};

type MissionContinuationInput = MissionContinuationContext;

const UNKNOWN_STATUS = "unknown";

function isNonNegativeInteger(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isOptionalString(value: unknown): value is string | undefined {
    return value === undefined || typeof value === "string";
}

function isOptionalNonNegativeInteger(value: unknown): value is number | undefined {
    return value === undefined || isNonNegativeInteger(value);
}

const STATE_FIELD_VALIDATORS = [
    ["active", (value: unknown) => typeof value === "boolean"],
    ["iteration", isNonNegativeInteger],
    ["prompt", (value: unknown) => typeof value === "string"],
    ["objective", isOptionalString],
    ["sessionID", (value: unknown) => typeof value === "string"],
    ["startedAt", (value: unknown) => typeof value === "string"],
    ["stagnationCount", isOptionalNonNegativeInteger],
    ["lastVerificationSummary", isOptionalString],
    ["lastContinuationReason", isOptionalString],
    ["lastContinuationAt", isOptionalString],
] as const;

const OPTIONAL_STATE_FIELDS = [
    "objective",
    "stagnationCount",
    "lastVerificationSummary",
    "lastContinuationReason",
    "lastContinuationAt",
] as const;

function parseLoopState(value: unknown): MissionLoopState | null {
    if (!isRecord(value)) return null;
    if (!STATE_FIELD_VALIDATORS.every(([field, validate]) => validate(value[field]))) return null;

    const optional = Object.fromEntries(
        OPTIONAL_STATE_FIELDS
            .filter(field => value[field] !== undefined)
            .map(field => [field, value[field]]),
    ) as Partial<MissionLoopState>;
    return {
        active: value.active as boolean,
        iteration: value.iteration as number,
        prompt: value.prompt as string,
        sessionID: value.sessionID as string,
        startedAt: value.startedAt as string,
        ...optional,
    };
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

    try {
        // A torn write would make readLoopState drop the mission silently.
        atomicWrite(filePath, JSON.stringify(state, null, 2));
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

    if (writeLoopState(directory, state)) {
        return state;
    }
    return null;
}

function deriveObjective(prompt: string): string {
    const firstLine = prompt.split(/\r?\n/).find(line => line.trim().length > 0);
    return firstLine?.trim() || prompt.trim() || "Continue the active mission";
}

function recordStartedMission(directory: string, state: MissionLoopState, previous?: MissionLoopState): void {
    if (previous) {
        appendMissionLedgerEvent(directory, {
            type: "mission_cancelled",
            sessionID: previous.sessionID,
            iteration: previous.iteration,
            objective: previous.objective,
            reason: "replaced_by_new_task",
        });
    }
    appendMissionLedgerEvent(directory, {
        type: "mission_started",
        sessionID: state.sessionID,
        iteration: state.iteration,
        objective: state.objective,
        summary: "Mission loop started",
    });
    syncMissionMemory(directory, state);
    log(`[${MISSION_CONTROL.LOG_SOURCE}] Loop started`, { sessionID: state.sessionID });
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
    const replaced = resolveReplacedMission(readLoopState(directory), sessionID, options.replaceExisting);
    const state: MissionLoopState = {
        active: true,
        iteration: 1,
        prompt,
        objective: deriveObjective(prompt),
        sessionID,
        startedAt: new Date().toISOString(),
    };

    const success = writeLoopState(directory, state);
    if (success) recordStartedMission(directory, state, replaced);
    return success;
}

type ReplaceTarget = MissionLoopOptions["replaceExisting"];

function matchesReplaceTarget(existing: MissionLoopState, target: ReplaceTarget): boolean {
    return existing.sessionID === target?.sessionID
        && existing.startedAt === target?.startedAt
        && existing.prompt === target?.prompt;
}

/**
 * Returns the other session's active mission that this start replaces, or
 * undefined when nothing is replaced. Replacing is allowed only when the caller
 * names the exact mission it expects to replace.
 */
function resolveReplacedMission(
    existing: MissionLoopState | null,
    sessionID: string,
    target: ReplaceTarget,
): MissionLoopState | undefined {
    if (!existing?.active || existing.sessionID === sessionID) return undefined;
    if (!matchesReplaceTarget(existing, target)) {
        throw new Error(`The active mission belongs to session ${existing.sessionID}. Retry /task to replace the current mission safely.`);
    }
    return existing;
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

<mission_loop iteration="${state.iteration}">
MISSION NOT COMPLETE

Objective:
${context.objective}

Runtime status:
- verification: ${context.verification}
- stagnation: ${context.stagnation}
- continuation reason: ${context.reason}

Completion rule: do not declare success while TODO, checklist, or sync verification still fails. Before finishing, give a brief self-account: scope fit against the objective, what verification ran, and any residual risk.
</mission_loop>`;

    if (context.escalate) {
        prompt += buildEscalationBlock(context.stagnation);
    }

    if (context.unverifiedFiles.length > 0) {
        prompt += buildVerificationAdvisory(context.unverifiedFiles);
    }

    // Inject Maintenance Instruction based on iteration
    if (state.iteration > 1) {
        prompt += "\n" + CLEANUP_INSTRUCTION.replace("%ITER%", state.iteration.toString());
    }

    return prompt;
}

function buildEscalationBlock(stagnation: string): string {
    return `\n\n<escalation reason="repeated_stagnation">
Stalled across ${stagnation}. Stop blind retries. ${RECOVERY_PRINCIPLE} Decompose the blocked step into verifiable pieces; if that does not unblock it, re-plan with a different approach; if still blocked, state the exact blocker and ASK the user for direction.
</escalation>`;
}

function buildVerificationAdvisory(unverifiedFiles: string[]): string {
    return `\n\n<verification_advisory>
These files changed with no recognized verification command afterward (advisory only; an unrecognized command may already cover them):
${unverifiedFiles.map(file => `- ${file}`).join("\n")}
Completion still depends on the TODO, checklist, and sync issue results.
</verification_advisory>`;
}

function normalizeContinuationContext(
    state: MissionLoopState,
    input?: MissionContinuationInput,
) {
    const { verificationSummary, continuationReason, unverifiedFiles } = readContinuationInput(input);
    const stagnationCount = state.stagnationCount ?? 0;
    return {
        objective: neutralizeLoopTags(state.objective || deriveObjective(state.prompt)),
        verification: neutralizeLoopTags(verificationSummary ?? state.lastVerificationSummary ?? UNKNOWN_STATUS),
        reason: neutralizeLoopTags(continuationReason ?? state.lastContinuationReason ?? "verification_failed"),
        stagnation: stagnationCount > 0 ? `${stagnationCount} unchanged check(s)` : "not detected",
        unverifiedFiles: unverifiedFiles.map(neutralizeLoopTags),
        escalate: stagnationCount >= ESCALATION_STAGNATION_THRESHOLD,
    };
}

function readContinuationInput(input?: MissionContinuationInput): MissionContinuationContext & { unverifiedFiles: string[] } {
    return {
        verificationSummary: input?.verificationSummary,
        continuationReason: input?.continuationReason,
        unverifiedFiles: input?.unverifiedFiles ?? [],
    };
}

/**
 * User and tool text is embedded inside `<mission_loop>`; an embedded opening
 * or closing tag would let it rewrite the block's structure.
 */
function neutralizeLoopTags(text: string): string {
    return text.replace(/<(\/?)mission_loop/gi, "&lt;$1mission_loop");
}
