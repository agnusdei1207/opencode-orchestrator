/**
 * Options for running background command
 */
export interface RunBackgroundOptions {
    command: string;
    cwd?: string;
    timeout?: number;
    label?: string;
}
