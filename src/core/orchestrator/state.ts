/**
 * Global State - Orchestration state manager
 */
import { SessionState } from "./interfaces/session-state.js";
import { LOOP, RECOVERY } from "../../shared/index.js";

export const state = {
    missionActive: false,
    maxIterations: LOOP.DEFAULT_MAX_ITERATIONS,
    maxRetries: RECOVERY.MAX_ATTEMPTS,
    sessions: new Map<string, SessionState>(),
};
