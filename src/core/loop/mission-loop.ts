/**
 * Mission Loop - Persistent Execution System
 * 
 * Ensures the mission continues until all TODO items are complete.
 * This system moves away from explicit signaling (seals) and relies
 * strictly on file-based state verification.
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { PluginInput } from "@opencode-ai/plugin";
import { log } from "../agents/logger.js";
import { PATHS, MISSION_CONTROL } from "../../shared/index.js";

// ============================================================================
// Constants
// ============================================================================

/** State file path */
const STATE_FILE = MISSION_CONTROL.STATE_FILE;

/** Default max iterations before giving up */
const DEFAULT_MAX_ITERATIONS = MISSION_CONTROL.DEFAULT_MAX_ITERATIONS;

// ============================================================================
// Types
// ============================================================================

export interface MissionLoopState {
    /** Whether loop is active */
    active: boolean;
    /** Current iteration number */
    iteration: number;
    /** Maximum allowed iterations */
    maxIterations: number;
    /** Original task prompt */
    prompt: string;
    /** Session ID */
    sessionID: string;
    /** When loop started */
    startedAt: string;
    /** Last activity timestamp */
    lastActivity?: string;
}

export interface MissionLoopOptions {
    /** Maximum iterations before stopping (default: 1000) */
    maxIterations?: number;
    /** Countdown seconds before auto-continue (default: 3) */
    countdownSeconds?: number;
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
        return JSON.parse(content) as MissionLoopState;
    } catch (error) {
        log(`[mission-loop] Failed to read state: ${error}`);
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
        log(`[mission-loop] Failed to write state: ${error}`);
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
        log(`[mission-loop] Failed to clear state: ${error}`);
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
        sessionID,
        startedAt: new Date().toISOString(),
    };

    const success = writeLoopState(directory, state);

    if (success) {
        log(`[mission-loop] Loop started`, {
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
        log(`[mission-loop] Loop cancelled`, { sessionID, iteration: state.iteration });
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
export function generateMissionContinuationPrompt(state: MissionLoopState, directory?: string): string {
    let verificationSummary = "";
    if (directory) {
        try {
            const { verifyMissionCompletion, buildVerificationSummary } = require("./verification.js");
            const v = verifyMissionCompletion(directory);
            verificationSummary = `\n[Verification Status]: ${buildVerificationSummary(v)}\n`;
        } catch { }
    }

    return `<mission_loop iteration="${state.iteration}" max="${state.maxIterations}">
⚠️ **MISSION NOT COMPLETE** - Iteration ${state.iteration}/${state.maxIterations}
${verificationSummary}

The mission is INCOMPLETE. You MUST continue working NOW.

**HIERARCHICAL TODO MANDATE**:
Your work is strictly governed by the hierarchy in \`.opencode/todo.md\`.
1️⃣ **Milestones (Grade 1)**: Large phases of the mission.
2️⃣ **Tasks (Grade 2)**: Sub-tasks within milestones.
3️⃣ **Sub-tasks (Grade 3)**: Atomic actions.

**CONCLUDING RULES**:
❌ Do NOT stop if there are ANY \`[ ]\` items remaining.
❌ Do NOT ask for permission to continue.
❌ Do NOT declare completion without verifying EVERY leaf node.

**REQUIRED SEQUENCE**:
1. Read \`.opencode/todo.md\` to identify the next \`[ ]\` item.
2. If the plan is too abstract, breakdown the next task into smaller sub-tasks.
3. Execute and mark as \`[x]\` ONLY after verification.
4. Move to the next item immediately.

**Your Original Task**:
${state.prompt}

**NOW**: Continue executing!
</mission_loop>`;
}

/**
 * Generate completion notification
 */
export function generateCompletionNotification(state: MissionLoopState): string {
    const duration = new Date().getTime() - new Date(state.startedAt).getTime();
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);

    return `🎖️ **MISSION COMPLETE**

- Iterations: ${state.iteration}/${state.maxIterations}
- Duration: ${minutes}m ${seconds}s
- Status: Verified`;
}

/**
 * Generate max iterations reached notification
 */
export function generateMaxIterationsNotification(state: MissionLoopState): string {
    return `⚠️ **Mission Loop Stopped**

- Iterations: ${state.iteration}/${state.maxIterations} (max reached)
- Status: Incomplete

Maximum iteration limit reached. Review the work done and decide how to proceed.`;
}
