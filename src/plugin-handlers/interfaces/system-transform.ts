/**
 * System Transform Handler Interfaces
 */

import type { Model } from "@opencode-ai/sdk";

/**
 * Input for system transform hook
 */
export interface SystemTransformInput {
    /** Session ID for the chat (optional per opencode Plugin type) */
    sessionID?: string;
    /** Active model metadata exposed by the OpenCode hook */
    model?: Model;
}

/**
 * Output for system transform hook
 */
export interface SystemTransformOutput {
    /** System prompt strings to inject */
    system: string[];
}
