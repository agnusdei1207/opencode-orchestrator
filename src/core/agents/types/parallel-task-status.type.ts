/**
 * ParallelTaskStatus - Task status type
 */

import { STATUS_LABEL } from "../../../shared/index.js";

export type ParallelTaskStatus =
    | typeof STATUS_LABEL.PENDING
    | typeof STATUS_LABEL.RUNNING
    | typeof STATUS_LABEL.COMPLETED
    | typeof STATUS_LABEL.FAILED
    | typeof STATUS_LABEL.ERROR
    | typeof STATUS_LABEL.TIMEOUT
    | typeof STATUS_LABEL.CANCELLED;
