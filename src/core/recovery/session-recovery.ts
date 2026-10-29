/**
 * Session Recovery Event Handler
 * 
 * Integrates with the OpenCode event system to automatically recover from session errors.
 * 
 * Recovered error types:
 * - tool_result_missing: Tool crashed, inject error message
 * - thinking_block_order / thinking_disabled: Thinking block issue
 *
 * Other detected types (rate_limit, which the host retries itself,
 * context_overflow, message_aborted, network, auth)
 * count against the cooldown and attempt budget but are not recovered here;
 * undetected errors touch no recovery state.
 */

import type { HostClient } from "../../host/client.js";
import { RECOVERY, detectErrorType, ERROR_TYPE } from "../../shared/index.js";
import { log } from "../../shared/logger.js";
import { isSessionBusy } from "../session/activity.js";
import { queueNotice } from "../session/pending-injection.js";

type RecoveryErrorType = NonNullable<ReturnType<typeof detectErrorType>>;

interface RecoveryState {
    isRecovering: boolean;
    lastErrorTime: number;
    errorCount: number;
}

interface PromptRecovery {
    prompt: string;
}

interface RecoveryExecution {
    client: HostClient;
    sessionID: string;
    errorType: RecoveryErrorType;
    state: RecoveryState;
}

type PreparedRecovery = Pick<RecoveryExecution, "errorType" | "state">;

// Recovery state per session
const recoveryState = new Map<string, RecoveryState>();

/**
 * Get recovery state for a session
 */
function getState(sessionID: string) {
    let state = recoveryState.get(sessionID);
    if (!state) {
        state = { isRecovering: false, lastErrorTime: 0, errorCount: 0 };
        recoveryState.set(sessionID, state);
    }
    return state;
}

/**
 * Recovery prompt for tool crash
 */
const TOOL_CRASH_RECOVERY_PROMPT = `<recovery type="tool_crash">
The previous tool execution failed. This is a system-level issue, not your fault.

<action>
1. Acknowledge the tool failure
2. Try an alternative approach using different tools
3. If the same tool is needed, retry with modified parameters
4. Continue with the original mission
</action>

Do NOT apologize excessively. Just proceed.
</recovery>`;

/**
 * Recovery prompt for thinking block issues
 */
const THINKING_RECOVERY_PROMPT = `<recovery type="thinking_block">
There was a temporary processing issue. Please continue from where you left off.

<action>
1. Review your current progress
2. Identify the next pending task
3. Continue execution
</action>
</recovery>`;

function promptRecoveryFor(errorType: RecoveryErrorType): PromptRecovery | null {
    switch (errorType) {
        case ERROR_TYPE.TOOL_RESULT_MISSING:
            return { prompt: TOOL_CRASH_RECOVERY_PROMPT };
        case ERROR_TYPE.THINKING_BLOCK_ORDER:
        case ERROR_TYPE.THINKING_DISABLED:
            return { prompt: THINKING_RECOVERY_PROMPT };
        default:
            return null;
    }
}

function injectRecoveryPrompt(
    client: HostClient,
    sessionID: string,
    prompt: string,
): void {
    void client.prompt({ sessionID, text: prompt }).catch((injectionError: unknown) => {
        log("[session-recovery] Failed to inject recovery prompt", {
            sessionID,
            error: injectionError,
        });
    });
}

async function recoverWithPrompt(
    client: HostClient,
    sessionID: string,
    errorType: RecoveryErrorType,
    recovery: PromptRecovery,
): Promise<boolean> {
    if (await isSessionBusy(client, sessionID)) {
        queueNotice(sessionID, recovery.prompt);
        log("[session-recovery] Session still working; queued recovery prompt for the next idle", {
            sessionID,
            errorType,
        });
        return true;
    }

    injectRecoveryPrompt(client, sessionID, recovery.prompt);
    log("[session-recovery] Recovery prompt injected (async)", { sessionID, errorType });
    return true;
}

async function executeRecovery(execution: RecoveryExecution): Promise<boolean> {
    const { client, sessionID, errorType } = execution;
    const promptRecovery = promptRecoveryFor(errorType);
    if (promptRecovery) return recoverWithPrompt(client, sessionID, errorType, promptRecovery);
    // Rate limits are retried by the host itself; nothing is injected for them.
    return false;
}

function prepareSessionRecovery(sessionID: string, error: unknown): PreparedRecovery | undefined {
    const state = getState(sessionID);
    if (state.isRecovering) {
        log("[session-recovery] Already recovering, skipping", { sessionID });
        return undefined;
    }

    // Unknown errors are left to the default handler before touching state, so
    // they neither start the cooldown nor spend the attempt budget that a
    // later recoverable error needs.
    const errorType = detectErrorType(error);
    if (!errorType) {
        log("[session-recovery] Unknown error type, using default handler", { sessionID, error });
        return undefined;
    }

    const now = Date.now();
    if (now - state.lastErrorTime < RECOVERY.RETRY_COOLDOWN_MS) {
        log("[session-recovery] Too soon since last error, skipping", { sessionID });
        return undefined;
    }
    state.lastErrorTime = now;
    state.errorCount++;

    log("[session-recovery] Detected error type", { sessionID, errorType, errorCount: state.errorCount });
    if (state.errorCount > RECOVERY.MAX_ATTEMPTS) {
        log("[session-recovery] Max recovery attempts exceeded", { sessionID });
        return undefined;
    }
    return { state, errorType };
}

/**
 * Handle session error event and attempt recovery
 */
export async function handleSessionError(
    client: HostClient,
    sessionID: string,
    error: unknown,
): Promise<boolean> {
    const prepared = prepareSessionRecovery(sessionID, error);
    if (!prepared) return false;
    prepared.state.isRecovering = true;
    try {
        return await executeRecovery({ client, sessionID, ...prepared });
    } catch (injectionError) {
        log("[session-recovery] Failed to inject recovery prompt", { sessionID, error: injectionError });
        return false;
    } finally {
        prepared.state.isRecovering = false;
    }
}

/**
 * Mark that recovery is complete for a session
 */
export function markRecoveryComplete(sessionID: string): void {
    const state = recoveryState.get(sessionID);
    if (state) {
        state.isRecovering = false;
        // Reset error count on successful message
        state.errorCount = 0;
    }
}

/**
 * Clean up session recovery state
 */
export function cleanupSessionRecovery(sessionID: string): void {
    recoveryState.delete(sessionID);
}
