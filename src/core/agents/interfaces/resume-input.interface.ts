/**
 * ResumeInput - Input for resuming an existing parallel task session
 * 
 * This allows continuing work in an existing session, preserving all context.
 * Useful for:
 * - Retry after failure (don't start from scratch)
 * - Follow-up questions to previous work
 * - Token efficiency (reuse context)
 */
export interface ResumeInput {
    /** Session ID to resume (from previous task.sessionID) */
    sessionId: string;
    /** New prompt to send to the resumed session */
    prompt: string;
    /** New parent session ID for notifications */
    parentSessionID: string;
}
