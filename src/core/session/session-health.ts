/**
 * Session Health Monitor
 * 
 * Periodically checks session health and detects stale sessions.
 * Early detection of infinite loading states improves system stability.
 */

import type { PluginInput } from "@opencode-ai/plugin";
import { log } from "../agents/logger.js";

type OpencodeClient = PluginInput["client"];

interface SessionHealthState {
    sessionID: string;
    lastActiveTime: number;      // Last user/system activity time
    lastResponseTime: number;    // Last assistant response time
    isStale: boolean;            // Stale flag
    activityCount: number;       // Activity count (for debugging)
}

const sessionHealth = new Map<string, SessionHealthState>();

// Configuration - Relaxed for parallel tasks to prevent false positives
const STALE_THRESHOLD_MS = 600000;      // Stale if no response for 10 minutes (was 2min)
const HEALTH_CHECK_INTERVAL_MS = 60000; // Check every 60 seconds (was 30s)
const WARNING_THRESHOLD_MS = 300000;    // Warn after 5 minutes (was 1min)

let healthCheckTimer: NodeJS.Timeout | undefined;
let client: OpencodeClient | undefined;

/**
 * Record session activity
 * 
 * Call this when an activity occurs in the session.
 * (e.g., sending prompt, tool execution)
 * 
 * @param sessionID - Session ID
 */
export function recordSessionActivity(sessionID: string): void {
    const now = Date.now();
    const existing = sessionHealth.get(sessionID);

    const health: SessionHealthState = existing ?? {
        sessionID,
        lastActiveTime: now,
        lastResponseTime: now,
        isStale: false,
        activityCount: 0,
    };

    health.lastActiveTime = now;
    health.activityCount++;

    // Recover from stale if activity detected
    if (health.isStale) {
        log("[session-health] Session recovered from stale", {
            sessionID: sessionID.slice(0, 8),
        });
        health.isStale = false;
    }

    sessionHealth.set(sessionID, health);
}

/**
 * Record session response receipt
 * 
 * Call this when a response is received from the session.
 * (e.g., assistant message received)
 * 
 * @param sessionID - Session ID
 */
export function recordSessionResponse(sessionID: string): void {
    const health = sessionHealth.get(sessionID);
    if (health) {
        health.lastResponseTime = Date.now();
        health.isStale = false;
    }
}

/**
 * Check if session is stale
 * 
 * @param sessionID - Session ID
 * @returns true if stale
 */
export function isSessionStale(sessionID: string): boolean {
    const health = sessionHealth.get(sessionID);
    if (!health) return false;

    // Return cached value (real-time check is done in healthCheck)
    return health.isStale;
}

/**
 * Get session response age
 * 
 * @param sessionID - Session ID
 * @returns Time elapsed since last response (ms), or -1 if session not found
 */
export function getSessionResponseAge(sessionID: string): number {
    const health = sessionHealth.get(sessionID);
    if (!health) return -1;

    return Date.now() - health.lastResponseTime;
}

/**
 * Get all stale session IDs
 * 
 * @returns Array of stale session IDs
 */
export function getStaleSessions(): string[] {
    return Array.from(sessionHealth.values())
        .filter(h => h.isStale)
        .map(h => h.sessionID);
}

/**
 * Start health check monitor
 * 
 * @param opencodeClient - OpenCode Client
 */
export function startHealthCheck(opencodeClient: OpencodeClient): void {
    if (healthCheckTimer) {
        log("[session-health] Health check already running");
        return;
    }

    client = opencodeClient;

    healthCheckTimer = setInterval(() => {
        performHealthCheck();
    }, HEALTH_CHECK_INTERVAL_MS);

    log("[session-health] Health check started", {
        intervalMs: HEALTH_CHECK_INTERVAL_MS,
        staleThresholdMs: STALE_THRESHOLD_MS,
    });
}

/**
 * Stop health check monitor
 */
export function stopHealthCheck(): void {
    if (healthCheckTimer) {
        clearInterval(healthCheckTimer);
        healthCheckTimer = undefined;
        log("[session-health] Health check stopped");
    }
}

/**
 * Perform actual health check (Exported for testing)
 */
export function performHealthCheck(): void {
    const now = Date.now();
    const warnings: string[] = [];
    const stales: string[] = [];

    for (const [sessionID, health] of sessionHealth) {
        const elapsed = now - health.lastResponseTime;

        // Warning level
        if (elapsed > WARNING_THRESHOLD_MS && elapsed <= STALE_THRESHOLD_MS && !health.isStale) {
            warnings.push(sessionID.slice(0, 8));
        }

        // Stale detection
        if (elapsed > STALE_THRESHOLD_MS && !health.isStale) {
            health.isStale = true;
            stales.push(sessionID.slice(0, 8));
        }
    }

    if (warnings.length > 0) {
        log("[session-health] Sessions approaching stale threshold", {
            sessions: warnings,
        });
    }

    if (stales.length > 0) {
        log("[session-health] Sessions marked as stale", {
            sessions: stales,
        });
    }
}

/**
 * Cleanup session health state
 * 
 * @param sessionID - Session ID
 */
export function cleanupSessionHealth(sessionID: string): void {
    sessionHealth.delete(sessionID);
}

/**
 * Clear all session health info (for testing)
 */
export function clearAllSessionHealth(): void {
    sessionHealth.clear();
}

/**
 * Get session health info (for debugging)
 * 
 * @param sessionID - Session ID
 */
export function getSessionHealth(sessionID: string): SessionHealthState | undefined {
    return sessionHealth.get(sessionID);
}

/**
 * Get overall health stats (for debugging)
 */
export function getHealthStats(): {
    total: number;
    stale: number;
    healthy: number;
    avgResponseAge: number;
} {
    const sessions = Array.from(sessionHealth.values());
    const now = Date.now();

    const stale = sessions.filter(s => s.isStale).length;
    const ages = sessions.map(s => now - s.lastResponseTime);
    const avgAge = ages.length > 0 ? ages.reduce((a, b) => a + b, 0) / ages.length : 0;

    return {
        total: sessions.length,
        stale,
        healthy: sessions.length - stale,
        avgResponseAge: Math.round(avgAge),
    };
}
