/**
 * Tool Hook Interfaces
 */

export interface ToolHookInput {
    tool: string;
    sessionID: string;
    callID: string;
    arguments?: Record<string, unknown>;
}

export interface ToolHookOutput {
    title: string;
    output: string;
    metadata: Record<string, unknown>;
}
