/**
 * Session State Interface
 */

export interface SessionState {
    active: boolean;
    step: number;
    timestamp: number;
    startTime: number;
    lastStepTime: number;
}
