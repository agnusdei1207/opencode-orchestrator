import type { MissionLoopState } from "../../shared/loop/types.js";
import type { VerificationResult } from "../../shared/verification/types.js";

export interface ContinuationMetadata {
    progress: string;
    verificationSummary: string;
    stagnant: boolean;
    scheduledAt: number;
}

function parseRemainingFromProgress(progress: string): number {
    const match = progress.match(/^(\d+)\/(\d+)$/);
    if (!match) return 0;

    const completed = Number(match[1]);
    const total = Number(match[2]);
    if (!Number.isFinite(completed) || !Number.isFinite(total)) return 0;
    return Math.max(total - completed, 0);
}

export function getVerificationRemainingCount(verification: VerificationResult): number {
    const checklistRemaining = parseRemainingFromProgress(verification.checklistProgress);
    const syncRemaining = verification.syncIssuesEmpty ? 0 : Math.max(verification.syncIssuesCount, 1);
    return verification.todoIncomplete + checklistRemaining + syncRemaining;
}

export function applyContinuationMetadata(
    state: MissionLoopState,
    metadata: ContinuationMetadata,
): MissionLoopState {
    return {
        ...state,
        lastProgress: metadata.progress,
        stagnationCount: metadata.stagnant ? (state.stagnationCount ?? 0) + 1 : 0,
        lastVerificationSummary: metadata.verificationSummary,
        lastContinuationReason: metadata.stagnant
            ? "stagnation_intervention"
            : "verification_failed",
        lastContinuationAt: new Date(metadata.scheduledAt).toISOString(),
    };
}
