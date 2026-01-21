/**
 * Session Compacting Handler Interfaces
 */

/**
 * Input for session compacting hook
 */
export interface SessionCompactingInput {
    /** Session ID being compacted */
    sessionID: string;
}

/**
 * Output for session compacting hook
 */
export interface SessionCompactingOutput {
    /** Additional context strings to append to compaction prompt */
    context: string[];
    /** Optional: Replace the default compaction prompt entirely */
    prompt?: string;
}
