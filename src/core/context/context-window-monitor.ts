/**
 * Context usage record: the latest host-reported token usage per session.
 * The resource-control hook reads it to decide when to ask for compaction.
 */

/** Usage ratio at which the resource-control hook asks for compaction. */
export const CONTEXT_THRESHOLDS = {
    WARNING: 0.85,
} as const;

export const CONTEXT_MONITOR_CONFIG = {
    /** Window assumed when neither the user nor the host gives one. */
    DEFAULT_MAX_TOKENS: 200000,
} as const;

/** A context measurement as reported by the host for one assistant message. */
interface ContextUsage {
    usedTokens: number;
    maxTokens: number;
}

const usageBySession = new Map<string, ContextUsage>();

export function calculateUsage(usedTokens: number, maxTokens: number): number {
    if (maxTokens <= 0) return 0;
    return usedTokens / maxTokens;
}

export function checkContextWindow(
    sessionID: string,
    usedTokens: number,
    maxTokens: number = CONTEXT_MONITOR_CONFIG.DEFAULT_MAX_TOKENS,
): void {
    usageBySession.set(sessionID, { usedTokens, maxTokens });
}

/**
 * The most recent host-reported measurement for a session, if one has been
 * seen. Preferred over any character-count estimate: it is what the model
 * actually consumed.
 */
export function getContextUsage(sessionID: string): ContextUsage | undefined {
    return usageBySession.get(sessionID);
}

export function cleanupSession(sessionID: string): void {
    usageBySession.delete(sessionID);
}
