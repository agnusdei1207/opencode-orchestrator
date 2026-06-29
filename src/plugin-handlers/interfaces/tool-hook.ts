/**
 * Tool Hook Interfaces
 */

export type ToolArgs = Record<string, unknown>;

export interface ToolHookBaseInput {
    tool: string;
    sessionID: string;
    callID: string;
}

export interface ToolBeforeHookOutput {
    args: ToolArgs;
}

export interface ToolAfterHookInput extends ToolHookBaseInput {
    args?: ToolArgs;
}

export interface ToolHookOutput {
    title: string;
    output: string;
    metadata: ToolArgs;
}
