/**
 * Global State - Orchestration state manager
 */
export interface SessionState {
    enabled: boolean;
    iterations: number;
    taskRetries: Map<string, number>;
    currentTask: string;
    anomalyCount: number;
    lastHealthyOutput?: string;
}

export const state = {
    sessions: new Map<string, SessionState>(),
};
