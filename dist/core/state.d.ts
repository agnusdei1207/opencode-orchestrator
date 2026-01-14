import { TaskGraph } from "./tasks.js";
export interface SessionState {
    enabled: boolean;
    iterations: number;
    taskRetries: Map<string, number>;
    currentTask: string;
    graph?: TaskGraph;
}
export declare const state: {
    missionActive: boolean;
    maxIterations: number;
    maxRetries: number;
    sessions: Map<string, SessionState>;
};
