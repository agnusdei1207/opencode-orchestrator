/**
 * LaunchInput - Input for launching a parallel task
 */
export interface LaunchInput {
    description: string;
    prompt: string;
    agent: string;
    parentSessionID: string;
    depth?: number;  // Current nesting depth (default: 1)
    mode?: "normal" | "race" | "fractal";
    groupID?: string;
}
