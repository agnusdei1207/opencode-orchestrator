/**
 * OS types
 */
import { PLATFORM } from "./constants.js";

export type Platform = (typeof PLATFORM)[keyof typeof PLATFORM];
