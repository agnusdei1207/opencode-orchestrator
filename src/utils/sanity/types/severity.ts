/**
 * Severity Type
 */

import { SEVERITY } from "../constants/severity.js";

export type Severity = (typeof SEVERITY)[keyof typeof SEVERITY];
