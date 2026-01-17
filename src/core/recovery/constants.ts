/**
 * Recovery Constants
 * 
 * @deprecated Use RECOVERY and HISTORY from shared/constants instead
 * This file is kept for backward compatibility only.
 */

import { RECOVERY, HISTORY } from "../../shared/index.js";

export const MAX_RETRIES = RECOVERY.MAX_ATTEMPTS;
export const BASE_DELAY = RECOVERY.BASE_DELAY_MS;
export const MAX_HISTORY = HISTORY.MAX_RECOVERY;


