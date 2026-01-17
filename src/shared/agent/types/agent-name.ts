/**
 * Agent name type (derived from AGENT_NAMES)
 */
import { AGENT_NAMES } from "../constants/names.js";

export type AgentName = (typeof AGENT_NAMES)[keyof typeof AGENT_NAMES];
