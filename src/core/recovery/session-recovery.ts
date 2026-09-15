/**
 * Session Recovery Event Handler
 * 
 * Integrates with the OpenCode event system to automatically recover from session errors.
 * 
 * Supported error types:
 * - tool_result_missing: Tool crashed, inject error message
 * - thinking_block_order: Thinking block ordering issue
 * - rate_limit: API rate limiting
 * - context_overflow: Token limit exceeded
 */

import type { PluginInput } from "@opencode-ai/plugin";
import { BACKGROUND_TASK, RECOVERY, detectErrorType, ERROR_TYPE } from "../../shared/index.js";
import { log } from "../agents/logger.js";
import { presets } from "../notification/toast.js";
import { syntheticTextPart } from "../session/injection.js";
import { isSessionBusy } from "../session/activity.js";
import { queueNotice } from "../session/pending-injection.js";
import { handleError, type ErrorContext } from "./handler.js";

type OpencodeClient = PluginInput["client"];
type RecoveryErrorType = NonNullable<ReturnType<typeof detectErrorType>>;

interface RecoveryState {
    isRecovering: boolean;
    lastErrorTime: number;
    errorCount: number;
}

interface PromptRecovery {
    prompt: string;
    toastMessage: string;
}

interface RecoveryExecution {
    client: OpencodeClient;
    sessionID: string;
    error: unknown;
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
            return { prompt: TOOL_CRASH_RECOVERY_PROMPT, toastMessage: "Tool Crash Recovery" };
        case ERROR_TYPE.THINKING_BLOCK_ORDER:
        case ERROR_TYPE.THINKING_DISABLED:
            return { prompt: THINKING_RECOVERY_PROMPT, toastMessage: "Thinking Block Recovery" };
        default:
            return null;
    }
}

async function recoverRateLimit(
    sessionID: string,
    error: unknown,
    state: RecoveryState,
): Promise<boolean> {
    const context: ErrorContext = {
        sessionId: sessionID,
        error: error instanceof Error ? error : new Error(String(error)),
        attempt: state.errorCount,
        timestamp: new Date(),
    };
    const action = handleError(context);
    if (action.type === "retry" && action.delay) {
        log("[session-recovery] Rate limit, waiting", { delay: action.delay });
        await new Promise(resolve => setTimeout(resolve, action.delay));
    }
    return true;
}

function injectRecoveryPrompt(
    client: OpencodeClient,
    sessionID: string,
    prompt: string,
): void {
    void client.session.prompt({
        path: { id: sessionID },
        body: { parts: [syntheticTextPart(prompt)] },
    }).catch(injectionError => {
        log("[session-recovery] Failed to inject recovery prompt", {
            sessionID,
            error: injectionError,
        });
    });
}

async function recoverWithPrompt(
    client: OpencodeClient,
    sessionID: string,
    errorType: RecoveryErrorType,
    recovery: PromptRecovery,
): Promise<boolean> {
    if (await isSessionBusy(client, sessionID)) {
        queueNotice(sessionID, recovery.prompt);
        presets.errorRecovery(recovery.toastMessage);
        log("[session-recovery] Session still working; queued recovery prompt for the next idle", {
            sessionID,
            errorType,
        });
        return true;
    }

    presets.errorRecovery(recovery.toastMessage);
    injectRecoveryPrompt(client, sessionID, recovery.prompt);
    log("[session-recovery] Recovery prompt injected (async)", { sessionID, errorType });
    return true;
}

async function executeRecovery(execution: RecoveryExecution): Promise<boolean> {
    const { client, sessionID, error, errorType, state } = execution;
    const promptRecovery = promptRecoveryFor(errorType);
    if (promptRecovery) return recoverWithPrompt(client, sessionID, errorType, promptRecovery);
    if (errorType === ERROR_TYPE.RATE_LIMIT) return recoverRateLimit(sessionID, error, state);
    if (errorType === ERROR_TYPE.MESSAGE_ABORTED) {
        log("[session-recovery] Message aborted by user, not recovering", { sessionID });
    }
    return false;
}

function prepareSessionRecovery(sessionID: string, error: unknown): PreparedRecovery | undefined {
    const state = getState(sessionID);
    if (state.isRecovering) {
        log("[session-recovery] Already recovering, skipping", { sessionID });
        return undefined;
    }

    const now = Date.now();
    if (now - state.lastErrorTime < BACKGROUND_TASK.RETRY_COOLDOWN_MS) {
        log("[session-recovery] Too soon since last error, skipping", { sessionID });
        return undefined;
    }
    state.lastErrorTime = now;
    state.errorCount++;

    const errorType = detectErrorType(error);
    if (!errorType) {
        log("[session-recovery] Unknown error type, using default handler", { sessionID, error });
        return undefined;
    }
    log("[session-recovery] Detected error type", { sessionID, errorType, errorCount: state.errorCount });
    if (state.errorCount > RECOVERY.MAX_ATTEMPTS) {
        log("[session-recovery] Max recovery attempts exceeded", { sessionID });
        presets.warningMaxRetries();
        return undefined;
    }
    return { state, errorType };
}

/**
 * Handle session error event and attempt recovery
 */
export async function handleSessionError(
    client: OpencodeClient,
    sessionID: string,
    error: unknown,
    _properties?: Record<string, unknown>
): Promise<boolean> {
    const prepared = prepareSessionRecovery(sessionID, error);
    if (!prepared) return false;
    prepared.state.isRecovering = true;
    try {
        return await executeRecovery({ client, sessionID, error, ...prepared });
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

/**
 * Check if session is currently recovering
 */
export function isSessionRecovering(sessionID: string): boolean {
    return recoveryState.get(sessionID)?.isRecovering ?? false;
}
