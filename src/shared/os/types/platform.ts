/**
 * OS Platform Type
 */

import { PLATFORM } from "../constants/platform.js";

export type Platform = typeof PLATFORM[keyof typeof PLATFORM];
