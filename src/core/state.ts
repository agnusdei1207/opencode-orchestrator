import { TaskGraph } from "./tasks.js";

export interface SessionState {
    enabled: boolean;
    iterations: number;
    taskRetries: Map<string, number>;
    currentTask: string;
    graph?: TaskGraph;
}

export const state = {
    missionActive: false,
    maxIterations: 1000, // Effectively infinite - "Relentless" mode
    maxRetries: 3,
    sessions: new Map<string, SessionState>(),
};
