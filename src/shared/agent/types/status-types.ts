/**
 * Status Types
 */

import { STATUS_LABEL } from "../../core/constants/status-labels.js";

export type TaskStatus = keyof typeof STATUS_LABEL;
