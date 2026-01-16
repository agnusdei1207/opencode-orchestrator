/**
 * Error Patterns - Recovery strategies for common errors
 */

import { MAX_RETRIES, BASE_DELAY } from "./constants.js";
import * as Toast from "../notification/toast.js";
import type { ErrorPattern, ErrorContext, RecoveryAction } from "./interfaces.js";

/**
 * Error patterns and their recovery strategies
 */
export const errorPatterns: ErrorPattern[] = [
    // Rate limiting
    {
        pattern: /rate.?limit|too.?many.?requests|429/i,
        category: "rate_limit",
        handler: (ctx: ErrorContext): RecoveryAction => {
            const delay = BASE_DELAY * Math.pow(2, ctx.attempt);
            Toast.presets.warningRateLimited();
            return { type: "retry", delay, attempt: ctx.attempt + 1 };
        },
    },

    // Context overflow
    {
        pattern: /context.?length|token.?limit|maximum.?context/i,
        category: "context_overflow",
        handler: (): RecoveryAction => {
            Toast.presets.errorRecovery("Compacting context");
            return { type: "compact", reason: "Context limit reached" };
        },
    },

    // Network errors
    {
        pattern: /ECONNREFUSED|ETIMEDOUT|network|fetch.?failed/i,
        category: "network",
        handler: (ctx: ErrorContext): RecoveryAction => {
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
        handler: (): RecoveryAction => {
            return { type: "abort", reason: "Session no longer available" };
        },
    },

    // Tool errors
    {
        pattern: /tool.?not.?found|unknown.?tool/i,
        category: "tool",
        handler: (ctx: ErrorContext): RecoveryAction => {
            return { type: "escalate", to: "Inspector", reason: `Unknown tool used by ${ctx.agent}` };
        },
    },

    // Parse errors
    {
        pattern: /parse.?error|invalid.?json|syntax.?error/i,
        category: "parse",
        handler: (ctx: ErrorContext): RecoveryAction => {
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
        handler: (): RecoveryAction => {
            Toast.presets.errorRecovery("Retrying with clean context");
            return { type: "retry", delay: 1000, attempt: 1 };
        },
    },
];
