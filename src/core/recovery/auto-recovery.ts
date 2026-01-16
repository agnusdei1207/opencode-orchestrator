/**
 * Auto Recovery System
 * 
 * Automatically handles and recovers from common errors
 * Implements exponential backoff, context compaction, and task retry
 */

import { EventBus, SESSION_EVENTS } from "../bus/index.js";
import * as Toast from "../notification/toast.js";

export type RecoveryAction =
    | { type: "retry"; delay: number; attempt: number }
    | { type: "skip"; reason: string }
    | { type: "escalate"; to: string; reason: string }
    | { type: "resume"; sessionId: string }
    | { type: "compact"; reason: string }
    | { type: "abort"; reason: string };

export interface ErrorContext {
    sessionId: string;
    taskId?: string;
    agent?: string;
    error: Error;
    attempt: number;
    timestamp: Date;
}

// Error patterns and their handlers
interface ErrorPattern {
    pattern: RegExp | string;
    category: string;
    handler: (context: ErrorContext) => RecoveryAction;
}

const MAX_RETRIES = 3;
const BASE_DELAY = 1000;

// Error tracking
const errorCounts = new Map<string, number>();
const recoveryHistory: Array<{
    context: ErrorContext;
    action: RecoveryAction;
    timestamp: Date;
}> = [];

/**
 * Error patterns and their recovery strategies
 */
const errorPatterns: ErrorPattern[] = [
    // Rate limiting
    {
        pattern: /rate.?limit|too.?many.?requests|429/i,
        category: "rate_limit",
        handler: (ctx) => {
            const delay = BASE_DELAY * Math.pow(2, ctx.attempt);
            Toast.presets.warningRateLimited();
            return { type: "retry", delay, attempt: ctx.attempt + 1 };
        },
    },

    // Context overflow
    {
        pattern: /context.?length|token.?limit|maximum.?context/i,
        category: "context_overflow",
        handler: () => {
            Toast.presets.errorRecovery("Compacting context");
            return { type: "compact", reason: "Context limit reached" };
        },
    },

    // Network errors
    {
        pattern: /ECONNREFUSED|ETIMEDOUT|network|fetch.?failed/i,
        category: "network",
        handler: (ctx) => {
            if (ctx.attempt >= MAX_RETRIES) {
                return { type: "abort", reason: "Network unavailable after retries" };
            }
            return { type: "retry", delay: BASE_DELAY * (ctx.attempt + 1), attempt: ctx.attempt + 1 };
        },
    },

    // Session errors
    {
        pattern: /session.?not.?found|session.?expired/i,
        category: "session",
        handler: () => {
            return { type: "abort", reason: "Session no longer available" };
        },
    },

    // Tool errors
    {
        pattern: /tool.?not.?found|unknown.?tool/i,
        category: "tool",
        handler: (ctx) => {
            return { type: "escalate", to: "inspector", reason: `Unknown tool used by ${ctx.agent}` };
        },
    },

    // Parse errors
    {
        pattern: /parse.?error|invalid.?json|syntax.?error/i,
        category: "parse",
        handler: (ctx) => {
            if (ctx.attempt >= 2) {
                return { type: "skip", reason: "Persistent parse error" };
            }
            return { type: "retry", delay: 500, attempt: ctx.attempt + 1 };
        },
    },

    // Gibberish / hallucination
    {
        pattern: /gibberish|hallucination|mixed.?language/i,
        category: "gibberish",
        handler: () => {
            Toast.presets.errorRecovery("Retrying with clean context");
            return { type: "retry", delay: 1000, attempt: 1 };
        },
    },
];

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
            if (recoveryHistory.length > 100) {
                recoveryHistory.shift();
            }

            // Emit event
            EventBus.emit(SESSION_EVENTS.ERROR, {
                sessionId: context.sessionId,
                category: pattern.category,
                action: action.type,
            });

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
export function getStats(): {
    totalRecoveries: number;
    byCategory: Record<string, number>;
    byAction: Record<string, number>;
    successRate: number;
} {
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
export function getHistory(limit = 10): typeof recoveryHistory {
    return recoveryHistory.slice(-limit);
}

/**
 * Clear error counts for a session
 */
export function clearSession(sessionId: string): void {
    // Clear session-specific error counts
    for (const key of errorCounts.keys()) {
        if (key.startsWith(sessionId)) {
            errorCounts.delete(key);
        }
    }
}
