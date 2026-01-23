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
import { PART_TYPES, BACKGROUND_TASK, RECOVERY, detectErrorType, getRetryDelay, ERROR_TYPE, type ErrorPatternType } from "../../shared/index.js";
import { log } from "../agents/logger.js";
import { presets } from "../../shared/index.js";
import { handleError } from "./handler.js";
import type { ErrorContext } from "./interfaces.js";

type OpencodeClient = PluginInput["client"];

// Recovery state per session
const recoveryState = new Map<string, {
    isRecovering: boolean;
    lastErrorTime: number;
    errorCount: number;
}>();

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

/**
 * Handle session error event and attempt recovery
 */
export async function handleSessionError(
    client: OpencodeClient,
    sessionID: string,
    error: unknown,
    properties?: Record<string, unknown>
): Promise<boolean> {
    const state = getState(sessionID);

    // Prevent recovery loops
    if (state.isRecovering) {
        log("[session-recovery] Already recovering, skipping", { sessionID });
        return false;
    }

    // Rate limit recovery attempts (use constant for consistency)
    const now = Date.now();
    if (now - state.lastErrorTime < BACKGROUND_TASK.RETRY_COOLDOWN_MS) {
        log("[session-recovery] Too soon since last error, skipping", { sessionID });
        return false;
    }

    state.lastErrorTime = now;
    state.errorCount++;

    // Detect error type
    const errorType = detectErrorType(error);
    if (!errorType) {
        log("[session-recovery] Unknown error type, using default handler", { sessionID, error });
        return false;
    }

    log("[session-recovery] Detected error type", { sessionID, errorType, errorCount: state.errorCount });

    // Max recovery attempts per session
    if (state.errorCount > RECOVERY.MAX_ATTEMPTS) {
        log("[session-recovery] Max recovery attempts exceeded", { sessionID });
        presets.warningMaxRetries();
        return false;
    }

    state.isRecovering = true;

    try {
        let recoveryPrompt: string | null = null;
        let toastMessage: string | null = null;

        switch (errorType) {
            case ERROR_TYPE.TOOL_RESULT_MISSING:
                recoveryPrompt = TOOL_CRASH_RECOVERY_PROMPT;
                toastMessage = "Tool Crash Recovery";
                break;

            case ERROR_TYPE.THINKING_BLOCK_ORDER:
            case ERROR_TYPE.THINKING_DISABLED:
                recoveryPrompt = THINKING_RECOVERY_PROMPT;
                toastMessage = "Thinking Block Recovery";
                break;

            case ERROR_TYPE.RATE_LIMIT:
                // Use existing recovery handler for rate limits (has backoff)
                const ctx: ErrorContext = {
                    sessionId: sessionID,
                    error: error instanceof Error ? error : new Error(String(error)),
                    attempt: state.errorCount,
                    timestamp: new Date(),
                };
                const action = handleError(ctx);
                if (action.type === "retry" && action.delay) {
                    log("[session-recovery] Rate limit, waiting", { delay: action.delay });
                    await new Promise(r => setTimeout(r, action.delay));
                    // Don't inject prompt, just wait and let natural retry happen
                }
                state.isRecovering = false;
                return true;

            case ERROR_TYPE.CONTEXT_OVERFLOW:
                // Suggest compaction (handled elsewhere)
                toastMessage = "Context Overflow - Consider compaction";
                state.isRecovering = false;
                return false;

            case ERROR_TYPE.MESSAGE_ABORTED:
                // User cancelled, don't auto-recover
                log("[session-recovery] Message aborted by user, not recovering", { sessionID });
                state.isRecovering = false;
                return false;

            default:
                state.isRecovering = false;
                return false;
        }

        if (recoveryPrompt && toastMessage) {
            presets.errorRecovery(toastMessage);

            // Fire and forget: Do NOT await prompt injection.
            // Prevents blocking the plugin process during error recovery turns.
            client.session.prompt({
                path: { id: sessionID },
                body: {
                    parts: [{ type: PART_TYPES.TEXT, text: recoveryPrompt }],
                },
            }).catch(injectionError => {
                log("[session-recovery] Failed to inject recovery prompt", { sessionID, error: injectionError });
            });

            log("[session-recovery] Recovery prompt injected (async)", { sessionID, errorType });
            state.isRecovering = false;
            return true;
        }

        state.isRecovering = false;
        return false;
    } catch (injectionError) {
        log("[session-recovery] Failed to inject recovery prompt", { sessionID, error: injectionError });
        state.isRecovering = false;
        return false;
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
