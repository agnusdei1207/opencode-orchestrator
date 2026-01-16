/**
 * Global State - Orchestration state manager
 */
import { SessionState } from "./interfaces/session-state.js";

export const state = {
    missionActive: false,
    maxIterations: 1000,
    maxRetries: 3,
    sessions: new Map<string, SessionState>(),
};
