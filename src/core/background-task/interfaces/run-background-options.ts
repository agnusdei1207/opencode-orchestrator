/**
 * RunBackgroundOptions - Options for running a background task
 */
export interface RunBackgroundOptions {
    command: string;
    cwd?: string;
    timeout?: number;
    label?: string;
}
