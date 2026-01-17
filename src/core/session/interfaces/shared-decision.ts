/**
 * Shared Decision Interface
 */

export interface SharedDecision {
    id: string;
    question: string;
    answer: string;
    rationale: string;
    decidedAt: Date;
}
