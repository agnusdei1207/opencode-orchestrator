/**
 * Poll Result Interface
 */

export interface PollResult {
    success: boolean;
    timedOut: boolean;
    error?: string;
    pollCount: number;
    elapsedMs: number;
}
