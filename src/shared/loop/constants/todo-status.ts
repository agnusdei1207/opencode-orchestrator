/**
 * Todo Status Constants
 */

import { STATUS_LABEL } from "../../core/constants/status-labels.js";

export const TODO_STATUS = {
    PENDING: STATUS_LABEL.PENDING,
    IN_PROGRESS: STATUS_LABEL.IN_PROGRESS,
    COMPLETED: STATUS_LABEL.COMPLETED,
    CANCELLED: STATUS_LABEL.CANCELLED,
} as const;
