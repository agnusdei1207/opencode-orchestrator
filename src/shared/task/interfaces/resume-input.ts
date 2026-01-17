/**
 * Input for resuming an existing parallel task session
 * 
 * Preserves context for:
 * - Retry after failure
 * - Follow-up questions
 * - Token efficiency
 */
export interface ResumeInput {
    /** Session ID to resume */
    sessionId: string;
    /** New prompt for resumed session */
    prompt: string;
    /** Parent session for notifications */
    parentSessionID: string;
}
