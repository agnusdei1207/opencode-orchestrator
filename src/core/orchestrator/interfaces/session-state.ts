/**
 * SessionState - State for a single orchestration session
 */
import type { TaskGraph } from "../task-graph.js";

export interface SessionState {
    enabled: boolean;
    iterations: number;
    taskRetries: Map<string, number>;
    currentTask: string;
    graph?: TaskGraph;
    anomalyCount: number;
    lastHealthyOutput?: string;
}
