/**
 * Tool Execute Handler Context
 */

import type { SessionState } from "./session-state.js";

export interface ToolExecuteHandlerContext {
    sessions: Map<string, SessionState>;
    directory: string;
}
