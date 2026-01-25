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
// import { TerminalMonitor } from "../progress/terminal-monitor.js";
import { CONTINUE_INSTRUCTION } from "../../shared/constants/system-messages.js";

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
    /** Last known progress string (e.g., "3/10") */
    lastProgress?: string;
    /** Number of iterations without progress */
    stagnationCount?: number;
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
export function generateMissionContinuationPrompt(state: MissionLoopState, verificationSummary?: string): string {
    const summaryHeader = verificationSummary ? `\n[Verification Status]: ${verificationSummary}\n` : "";

    return `${CONTINUE_INSTRUCTION}

<mission_loop iteration="${state.iteration}" max="${state.maxIterations}">
⚠️ **MISSION NOT COMPLETE** - Iteration ${state.iteration}/${state.maxIterations}
${summaryHeader}

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

/**
 * Stagnation intervention prompt
 */
export const STAGNATION_INTERVENTION = `
<system_intervention type="stagnation_detected">
⚠️ **경고: 진행 정체 감지 (STAGNATION DETECTED)**
최근 여러 턴 동안 실질적인 진전이 감지되지 않았습니다. 단순 "모니터링"이나 같은 행동을 반복하는 것은 금지됩니다.

**자율적 진단 및 해결 지침:**
1. **실시간 로그 확인**: \`check_background_task\` 또는 \`read_file\`을 사용하여 진행 중인 작업의 출력 로그를 직접 확인하십시오.
2. **프로세스 생존 진단**: 작업이 좀비 상태이거나 멈춘 것 같다면 과감하게 \`kill\`하고 단계를 세분화하여 다시 실행하십시오.
3. **전략 전환**: 동일한 접근 방식이 실패하고 있다면, 다른 도구나 방법을 사용하여 목표에 도달하십시오.

**지금 바로 능동적으로 개입하십시오. 대기하지 마십시오.**
</system_intervention>`;
