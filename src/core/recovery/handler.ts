/**
 * Recovery Handler - Core error handling logic
 */

import { MAX_RETRIES, BASE_DELAY, MAX_HISTORY } from "./constants.js";
import { errorPatterns } from "./patterns.js";
import type { ErrorContext, RecoveryAction, RecoveryRecord, RecoveryStats } from "./interfaces.js";

// Error tracking
const errorCounts = new Map<string, number>();
const recoveryHistory: RecoveryRecord[] = [];

/**
 * Handle an error and determine recovery action
 */
export function handleError(context: ErrorContext): RecoveryAction {
    const errorMessage = context.error.message || String(context.error);

    // Find matching pattern
    for (const pattern of errorPatterns) {
        const matches = typeof pattern.pattern === "string"
            ? errorMessage.includes(pattern.pattern)
            : pattern.pattern.test(errorMessage);

        if (matches) {
            const action = pattern.handler(context);

            // Record recovery attempt
            recoveryHistory.push({
                context,
                action,
                timestamp: new Date(),
            });

            // Trim history
            if (recoveryHistory.length > MAX_HISTORY) {
                recoveryHistory.shift();
            }

            // Note: Previously emitted SESSION_EVENTS.ERROR but no subscribers
            // Error info is already in recoveryHistory

            return action;
        }
    }

    // Default: retry with backoff
    if (context.attempt < MAX_RETRIES) {
        return {
            type: "retry",
            delay: BASE_DELAY * Math.pow(2, context.attempt),
            attempt: context.attempt + 1,
        };
    }

    return { type: "abort", reason: `Unknown error after ${MAX_RETRIES} retries` };
}

/**
 * Execute a function with auto-recovery
 */
export async function withRecovery<T>(
    sessionId: string,
    fn: () => Promise<T>,
    options: {
        maxRetries?: number;
        onRetry?: (action: RecoveryAction) => void;
    } = {}
): Promise<T> {
    const maxRetries = options.maxRetries ?? MAX_RETRIES;
    let attempt = 0;

    while (true) {
        try {
            return await fn();
        } catch (error) {
            attempt++;

            const context: ErrorContext = {
                sessionId,
                error: error instanceof Error ? error : new Error(String(error)),
                attempt,
                timestamp: new Date(),
            };

            const action = handleError(context);
            options.onRetry?.(action);

            switch (action.type) {
                case "retry":
                    if (action.attempt > maxRetries) {
                        throw error;
                    }
                    await new Promise(r => setTimeout(r, action.delay));
                    continue;

                case "abort":
                    throw new Error(`Recovery aborted: ${action.reason}`);

                case "skip":
                    console.log(`[Recovery] Skipping: ${action.reason}`);
                    return undefined as T;

                default:
                    throw error;
            }
        }
    }
}

/**
 * Get recovery statistics
 */
export function getStats(): RecoveryStats {
    const byCategory: Record<string, number> = {};
    const byAction: Record<string, number> = {};
    let successful = 0;

    for (const record of recoveryHistory) {
        const category = errorPatterns.find(p => {
            const msg = record.context.error.message;
            return typeof p.pattern === "string"
                ? msg.includes(p.pattern)
                : p.pattern.test(msg);
        })?.category || "unknown";

        byCategory[category] = (byCategory[category] || 0) + 1;
        byAction[record.action.type] = (byAction[record.action.type] || 0) + 1;

        if (record.action.type === "retry" || record.action.type === "skip") {
            successful++;
        }
    }

    return {
        totalRecoveries: recoveryHistory.length,
        byCategory,
        byAction,
        successRate: recoveryHistory.length > 0
            ? Math.round(successful / recoveryHistory.length * 100)
            : 100,
    };
}

/**
 * Get recent recovery history
 */
export function getHistory(limit = 10): RecoveryRecord[] {
    return recoveryHistory.slice(-limit);
}

/**
 * Clear error counts for a session
 */
export function clearSession(sessionId: string): void {
    for (const key of errorCounts.keys()) {
        if (key.startsWith(sessionId)) {
            errorCounts.delete(key);
        }
    }
}
