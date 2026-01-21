/**
 * System Transform Handler Interfaces
 */

/**
 * Input for system transform hook
 */
export interface SystemTransformInput {
    /** Session ID for the chat */
    sessionID: string;
}

/**
 * Output for system transform hook
 */
export interface SystemTransformOutput {
    /** System prompt strings to inject */
    system: string[];
}
