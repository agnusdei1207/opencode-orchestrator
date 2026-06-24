/**
 * Global State - Orchestration state manager
 */
import { LOOP, RECOVERY } from "../../shared/index.js";

export interface SessionState {
    enabled: boolean;
    iterations: number;
    taskRetries: Map<string, number>;
    currentTask: string;
    anomalyCount: number;
    lastHealthyOutput?: string;
}

export const state = {
    missionActive: false,
    maxIterations: LOOP.DEFAULT_MAX_ITERATIONS,
    maxRetries: RECOVERY.MAX_ATTEMPTS,
    sessions: new Map<string, SessionState>(),
};
