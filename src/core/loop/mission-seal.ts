/**
 * Mission Seal - Explicit completion detection system
 * 
 * When an agent outputs `<mission_seal>SEALED</mission_seal>`,
 * the task loop knows the mission is truly complete.
 * 
 * This prevents false-positive idle detection and ensures
 * agents explicitly confirm task completion.
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { PluginInput } from "@opencode-ai/plugin";
import { log } from "../agents/logger.js";
import { PATHS, PART_TYPES, MISSION_SEAL } from "../../shared/constants.js";

// ============================================================================
// Constants (derived from centralized MISSION_SEAL)
// ============================================================================

/** Tag for mission seal detection */
export const MISSION_SEAL_TAG = MISSION_SEAL.TAG;

/** Seal confirmation value */
export const SEAL_CONFIRMATION = MISSION_SEAL.CONFIRMATION;

/** Full seal pattern: <mission_seal>SEALED</mission_seal> */
export const SEAL_PATTERN = MISSION_SEAL.PATTERN;

/** Regex for detecting seal in text */
export const SEAL_REGEX = new RegExp(
    `<${MISSION_SEAL.TAG}>\\s*${MISSION_SEAL.CONFIRMATION}\\s*</${MISSION_SEAL.TAG}>`,
    "i"
);

/** State file path */
const STATE_FILE = MISSION_SEAL.STATE_FILE;

/** Default max iterations before giving up */
const DEFAULT_MAX_ITERATIONS = MISSION_SEAL.DEFAULT_MAX_ITERATIONS;

/** Default countdown before auto-continue (seconds) */
const DEFAULT_COUNTDOWN_SECONDS = MISSION_SEAL.DEFAULT_COUNTDOWN_SECONDS;

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
    /** Maximum iterations before stopping (default: 20) */
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
        log(`[mission-seal] Failed to read state: ${error}`);
        return null;
    }
}

/**
 * Write loop state to disk
 */
export function writeLoopState(directory: string, state: MissionLoopState): boolean {
    const filePath = getStateFilePath(directory);

    try {
        writeFileSync(filePath, JSON.stringify(state, null, 2), "utf-8");
        return true;
    } catch (error) {
        log(`[mission-seal] Failed to write state: ${error}`);
        return false;
    }
}

/**
 * Clear loop state (delete file)
 */
export function clearLoopState(directory: string): boolean {
    const filePath = getStateFilePath(directory);

    if (!existsSync(filePath)) {
        return true;
    }

    try {
        unlinkSync(filePath);
        return true;
    } catch (error) {
        log(`[mission-seal] Failed to clear state: ${error}`);
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
// Detection
// ============================================================================

/**
 * Check if text contains mission seal
 */
export function detectSealInText(text: string): boolean {
    return SEAL_REGEX.test(text);
}

/**
 * Check session messages for mission seal
 */
export async function detectSealInSession(
    client: PluginInput["client"],
    sessionID: string
): Promise<boolean> {
    try {
        const response = await client.session.messages({ path: { id: sessionID } });
        const messages = (response.data ?? []) as Array<{
            info?: { role?: string };
            parts?: Array<{ type?: string; text?: string }>;
        }>;

        // Check last few assistant messages
        const assistantMessages = messages.filter(m => m.info?.role === "assistant");
        const recentMessages = assistantMessages.slice(-3); // Last 3 assistant messages

        for (const msg of recentMessages) {
            if (!msg.parts) continue;

            const textParts = msg.parts.filter(
                p => p.type === PART_TYPES.TEXT || p.type === PART_TYPES.REASONING
            );

            for (const part of textParts) {
                if (part.text && detectSealInText(part.text)) {
                    return true;
                }
            }
        }

        return false;
    } catch (error) {
        log(`[mission-seal] Failed to check session messages: ${error}`);
        return false;
    }
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
        log(`[mission-seal] Loop started`, {
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
        log(`[mission-seal] Loop cancelled`, { sessionID, iteration: state.iteration });
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

/**
 * Get remaining iterations
 */
export function getRemainingIterations(directory: string): number {
    const state = readLoopState(directory);
    if (!state) return 0;
    return Math.max(0, state.maxIterations - state.iteration);
}

// ============================================================================
// Continuation Prompt
// ============================================================================

/**
 * Generate continuation prompt for mission loop
 */
export function generateMissionContinuationPrompt(state: MissionLoopState): string {
    return `<mission_loop iteration="${state.iteration}" max="${state.maxIterations}">
📋 **Mission Loop Active** - Iteration ${state.iteration}/${state.maxIterations}

Your previous iteration did not seal the mission. Continue working.

**RULES**:
1. Review your progress from the previous iteration
2. Continue from where you left off
3. Check TODO list for incomplete items
4. When ALL work is TRULY complete, output:

\`\`\`
${SEAL_PATTERN}
\`\`\`

**IMPORTANT**: 
- Do NOT seal until the mission is genuinely complete
- Verify all todos are marked [x] before sealing
- Run tests/builds if applicable before sealing

**Original Task**:
${state.prompt}
</mission_loop>`;
}

/**
 * Generate completion notification
 */
export function generateSealedNotification(state: MissionLoopState): string {
    const duration = new Date().getTime() - new Date(state.startedAt).getTime();
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);

    return `🎖️ **MISSION SEALED**

- Iterations: ${state.iteration}/${state.maxIterations}
- Duration: ${minutes}m ${seconds}s
- Status: Complete

The agent has confirmed mission completion.`;
}

/**
 * Generate max iterations reached notification
 */
export function generateMaxIterationsNotification(state: MissionLoopState): string {
    return `⚠️ **Mission Loop Stopped**

- Iterations: ${state.iteration}/${state.maxIterations} (max reached)
- Status: Incomplete

The mission loop reached the maximum iteration limit without sealing.
Review the work done and decide how to proceed.`;
}
