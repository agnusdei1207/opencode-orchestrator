/**
 * Agent-related constants
 */

import { AGENT_NAMES } from "../shared/contracts/names.js";

// ============================================================================
// Agent Emojis
// ============================================================================

export const AGENT_EMOJI: Record<string, string> = {
  [AGENT_NAMES.ARCHITECT]: "🏗️",
  [AGENT_NAMES.BUILDER]: "🔨",
  [AGENT_NAMES.INSPECTOR]: "🔍",
  [AGENT_NAMES.RECORDER]: "💾",
  [AGENT_NAMES.COMMANDER]: "🎯",
  [AGENT_NAMES.FRONTEND_DESIGNER]: "🎨",
};

// ============================================================================
// Agent Permissions
// ============================================================================

export const AGENT_CAPABILITIES = {
  canWrite: true,
  canBash: true,
} as const;
