/**
 * Session State Interface
 */

export interface SessionState {
    active: boolean;
    step: number;
    timestamp: number;
    startTime: number;
    lastStepTime: number;
    tokens: {
        totalInput: number;
        totalOutput: number;
        estimatedCost: number;
    };
}
