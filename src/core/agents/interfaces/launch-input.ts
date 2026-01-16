/**
 * LaunchInput - Input for launching a parallel task
 */
export interface LaunchInput {
    description: string;
    prompt: string;
    agent: string;
    parentSessionID: string;
}
