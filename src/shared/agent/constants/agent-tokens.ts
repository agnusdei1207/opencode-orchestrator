/**
 * Agent Token Configuration
 */

export const AGENT_TOKENS = {
    /** Primary agent (Commander) max tokens */
    PRIMARY_MAX_TOKENS: 64000,
    /** Primary agent thinking budget */
    PRIMARY_THINKING_BUDGET: 32000,
    /** Subagent max tokens */
    SUBAGENT_MAX_TOKENS: 32000,
} as const;
