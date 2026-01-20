/**
 * Context Window Monitor
 * 
 * Monitors context window usage and alerts when thresholds are exceeded.
 * 
 * Thresholds:
 * - 70%: Info alert - "Still plenty of headroom"
 * - 85%: Warning - Consider compaction
 * - 95%: Critical - Immediate action needed
 */

import * as Toast from "../notification/toast.js";
import { log } from "../agents/logger.js";

// ============================================================
// Constants
// ============================================================

export const CONTEXT_THRESHOLDS = {
    /** Info level - remind agent there's still room */
    INFO: 0.70,
    /** Warning level - consider compaction soon */
    WARNING: 0.85,
    /** Critical level - immediate action needed */
    CRITICAL: 0.95,
} as const;

export const CONTEXT_MONITOR_CONFIG = {
    /** Default max tokens for most models */
    DEFAULT_MAX_TOKENS: 200000,
    /** Check interval in milliseconds */
    CHECK_INTERVAL_MS: 30000,
    /** Minimum time between alerts (ms) */
    ALERT_COOLDOWN_MS: 60000,
} as const;

// ============================================================
// State
// ============================================================

interface MonitorState {
    lastAlertTime: number;
    lastAlertLevel: "info" | "warning" | "critical" | null;
    isMonitoring: boolean;
    intervalId?: ReturnType<typeof setInterval>;
}

const sessionStates = new Map<string, MonitorState>();

// ============================================================
// Core Functions
// ============================================================

function getState(sessionID: string): MonitorState {
    let state = sessionStates.get(sessionID);
    if (!state) {
        state = {
            lastAlertTime: 0,
            lastAlertLevel: null,
            isMonitoring: false,
        };
        sessionStates.set(sessionID, state);
    }
    return state;
}

/**
 * Calculate context usage percentage
 */
export function calculateUsage(usedTokens: number, maxTokens: number): number {
    if (maxTokens <= 0) return 0;
    return usedTokens / maxTokens;
}

/**
 * Get alert level based on usage
 */
export function getAlertLevel(usage: number): "info" | "warning" | "critical" | null {
    if (usage >= CONTEXT_THRESHOLDS.CRITICAL) return "critical";
    if (usage >= CONTEXT_THRESHOLDS.WARNING) return "warning";
    if (usage >= CONTEXT_THRESHOLDS.INFO) return "info";
    return null;
}

/**
 * Format usage for display
 */
export function formatUsage(usage: number, usedTokens: number, maxTokens: number): string {
    const percentage = Math.round(usage * 100);
    const usedK = Math.round(usedTokens / 1000);
    const maxK = Math.round(maxTokens / 1000);
    return `${percentage}% (${usedK}k/${maxK}k tokens)`;
}

/**
 * Get alert message based on level
 */
function getAlertMessage(level: "info" | "warning" | "critical", usage: number, usedTokens: number, maxTokens: number): { title: string; message: string; variant: "info" | "warning" } {
    const usageStr = formatUsage(usage, usedTokens, maxTokens);

    switch (level) {
        case "info":
            return {
                title: "📊 Context Window Status",
                message: `${usageStr} - Still plenty of headroom. Continue without rushing.`,
                variant: "info",
            };
        case "warning":
            return {
                title: "⚠️ Context Window Alert",
                message: `${usageStr} - Consider wrapping up current task or requesting compaction.`,
                variant: "warning",
            };
        case "critical":
            return {
                title: "🚨 Context Window Critical",
                message: `${usageStr} - Compaction recommended. Context may be truncated soon.`,
                variant: "warning",
            };
    }
}

// ============================================================
// Public API
// ============================================================

/**
 * Check context window usage and alert if needed
 */
export function checkContextWindow(
    sessionID: string,
    usedTokens: number,
    maxTokens: number = CONTEXT_MONITOR_CONFIG.DEFAULT_MAX_TOKENS
): void {
    const usage = calculateUsage(usedTokens, maxTokens);
    const level = getAlertLevel(usage);

    if (!level) return;

    const state = getState(sessionID);
    const now = Date.now();

    // Check cooldown
    if (now - state.lastAlertTime < CONTEXT_MONITOR_CONFIG.ALERT_COOLDOWN_MS) {
        // Only alert if level increased
        if (state.lastAlertLevel === level) return;
        if (state.lastAlertLevel === "critical") return;
        if (state.lastAlertLevel === "warning" && level === "info") return;
    }

    // Show alert
    const alert = getAlertMessage(level, usage, usedTokens, maxTokens);
    Toast.show({ title: alert.title, message: alert.message, variant: alert.variant });

    // Update state
    state.lastAlertTime = now;
    state.lastAlertLevel = level;

    log("[context-window-monitor] Alert shown", { sessionID, level, usage: Math.round(usage * 100) });
}

/**
 * Get injection prompt for context-aware agents
 * This reminds agents about context status when usage is high
 */
export function getContextInjection(
    usedTokens: number,
    maxTokens: number = CONTEXT_MONITOR_CONFIG.DEFAULT_MAX_TOKENS
): string | null {
    const usage = calculateUsage(usedTokens, maxTokens);
    const level = getAlertLevel(usage);

    if (!level) return null;

    const usageStr = formatUsage(usage, usedTokens, maxTokens);

    if (level === "info") {
        return `[SYSTEM NOTE - Context Window: ${usageStr}] You have plenty of headroom. No need to rush or be overly concise. Focus on quality.`;
    }

    if (level === "warning") {
        return `[SYSTEM NOTE - Context Window: ${usageStr}] Context is getting full. Consider: (1) Completing current task, (2) Being more concise, (3) Requesting session compaction if needed.`;
    }

    if (level === "critical") {
        return `[SYSTEM NOTE - Context Window: ${usageStr}] CRITICAL: Context near limit. Complete current work immediately. Session may need compaction.`;
    }

    return null;
}

/**
 * Cleanup session state
 */
export function cleanupSession(sessionID: string): void {
    const state = sessionStates.get(sessionID);
    if (state?.intervalId) {
        clearInterval(state.intervalId);
    }
    sessionStates.delete(sessionID);
    log("[context-window-monitor] Session cleaned up", { sessionID });
}

/**
 * Get current monitor status for debugging
 */
export function getMonitorStatus(sessionID: string): {
    lastAlertTime: number;
    lastAlertLevel: string | null;
    isMonitoring: boolean;
} | null {
    const state = sessionStates.get(sessionID);
    if (!state) return null;
    return {
        lastAlertTime: state.lastAlertTime,
        lastAlertLevel: state.lastAlertLevel,
        isMonitoring: state.isMonitoring,
    };
}
