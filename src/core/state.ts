import { TaskGraph } from "./tasks.js";
import { MAX_TASK_RETRIES } from "../constants/time.js";

export interface SessionState {
    enabled: boolean;
    iterations: number;
    taskRetries: Map<string, number>;
    currentTask: string;
    graph?: TaskGraph;
    anomalyCount: number; // Consecutive gibberish/malformed output count
    lastHealthyOutput?: string; // Last known good output for recovery context
}

export const state = {
    missionActive: false,
    maxIterations: 1000, // Effectively infinite - "Relentless" mode
    maxRetries: MAX_TASK_RETRIES,
    sessions: new Map<string, SessionState>(),
};
