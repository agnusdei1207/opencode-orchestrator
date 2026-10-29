/**
 * Loop types and interfaces (consolidated)
 */

/**
 * Mission Loop Interfaces
 */

export interface MissionLoopState {
    /** Whether loop is active */
    active: boolean;
    /** Current iteration number */
    iteration: number;
    /** Original task prompt */
    prompt: string;
    /** Compact objective title shown in continuation prompts */
    objective?: string;
    /** Session ID */
    sessionID: string;
    /** When loop started */
    startedAt: string;
    /** Number of iterations without progress */
    stagnationCount?: number;
    /** Last verification summary observed before continuation */
    lastVerificationSummary?: string;
    /** Last reason the loop decided to continue */
    lastContinuationReason?: string;
    /** Last continuation timestamp */
    lastContinuationAt?: string;
}

export interface MissionLoopOptions {
    /** Expected prior mission; permits replacement only if its identity still matches. */
    replaceExisting?: Pick<MissionLoopState, "sessionID" | "startedAt" | "prompt">;
}
