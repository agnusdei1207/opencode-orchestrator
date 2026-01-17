/**
 * SessionState - State for a single orchestration session
 */

export interface SessionState {
    enabled: boolean;
    iterations: number;
    taskRetries: Map<string, number>;
    currentTask: string;
    anomalyCount: number;
    lastHealthyOutput?: string;
}
