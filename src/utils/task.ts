import * as crypto from "crypto";

/**
 * Task-related utility functions
 */

import { TASK_ID_PREFIX, JOB_ID_PREFIX } from "../constants/task.js";

/**
 * Generate a unique task ID in format task_xxxxxxxx
 */
export function generateTaskId(): string {
  const hex = crypto.randomBytes(4).toString("hex");
  return `${TASK_ID_PREFIX}${hex}`;
}

/**
 * Generate a unique job ID in format job_xxxxxxxx
 */
export function generateJobId(): string {
  const hex = crypto.randomBytes(4).toString("hex");
  return `${JOB_ID_PREFIX}${hex}`;
}
