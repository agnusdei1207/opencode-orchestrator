/**
 * Background Task Status
 */

export const BACKGROUND_STATUS = {
    RUNNING: "running",
    DONE: "done",
    ERROR: "error",
    TIMEOUT: "timeout",
} as const;

export type BackgroundStatus = (typeof BACKGROUND_STATUS)[keyof typeof BACKGROUND_STATUS];
