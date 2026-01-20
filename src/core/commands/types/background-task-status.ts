/**
 * BackgroundTaskStatus - Task status union type
 * Uses STATUS_LABEL constants for consistency
 */
import { STATUS_LABEL } from "../../../shared/index.js";

export type BackgroundTaskStatus =
    | typeof STATUS_LABEL.PENDING
    | typeof STATUS_LABEL.RUNNING
    | typeof STATUS_LABEL.DONE
    | typeof STATUS_LABEL.ERROR
    | typeof STATUS_LABEL.TIMEOUT;

/**
 * Background task status constants
 */
export const BACKGROUND_TASK_STATUS = {
    PENDING: STATUS_LABEL.PENDING,
    RUNNING: STATUS_LABEL.RUNNING,
    DONE: STATUS_LABEL.DONE,
    ERROR: STATUS_LABEL.ERROR,
    TIMEOUT: STATUS_LABEL.TIMEOUT,
} as const;
