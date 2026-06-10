/**
 * Session State Interface
 */

export interface SessionState {
    active: boolean;
    step: number;
    timestamp: number;
    startTime: number;
    lastStepTime: number;
    lastCompletedMessageID?: string;
    lastUserMessageAt?: number;
    lastAssistantCompletedAt?: number;
    lastAbortAt?: number;
    tokens: {
        totalInput: number;
        totalOutput: number;
        estimatedCost: number;
    };
}
