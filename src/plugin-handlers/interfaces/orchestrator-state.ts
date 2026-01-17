/**
 * Orchestrator State Interface
 */

export interface OrchestratorState {
    missionActive: boolean;
    sessions: Map<string, {
        enabled: boolean;
        iterations: number;
        taskRetries: Map<string, number>;
        currentTask: string;
        anomalyCount: number;
        lastHealthyOutput?: string;
    }>;
}
