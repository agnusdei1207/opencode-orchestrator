
/**
 * Strict Role Guard Hook
 *
 * A last-resort safety net over command execution: it blocks the two shapes that
 * are destructive no matter which agent issued them (fork bombs, root deletion).
 *
 * Role separation itself is NOT enforced here. It is expressed in the prompts —
 * see the authoritative Role Permission Matrix in
 * `src/agents/prompts/shared/role-matrix.ts` — because the orchestrator delegates
 * to real OpenCode agents whose tool access is governed by the user's own
 * permission configuration. Re-implementing that as a hard block here would
 * override the user's config rather than complement it.
 */

import type { PreToolUseHook, HookContext, PreToolResult, ToolInput } from "../registry.js";
import { TOOL_NAMES } from "../../shared/index.js";
import { HOOK_ACTIONS, HOOK_NAMES } from "../constants.js";
import { SECURITY_PATTERNS } from "../../shared/constants/security-patterns.js";
import { MISSION_MESSAGES } from "../../shared/constants/system-messages.js";

export class StrictRoleGuardHook implements PreToolUseHook {
    name = HOOK_NAMES.STRICT_ROLE_GUARD;

    async execute(_ctx: HookContext, tool: string, args: ToolInput): Promise<PreToolResult> {
        // Applies to both foreground and background command execution.
        if (tool === TOOL_NAMES.RUN_COMMAND || tool === TOOL_NAMES.RUN_BACKGROUND) {
            const cmd = typeof args.command === "string" ? args.command : undefined;
            if (cmd) {
                // Prevent Fork Bomb
                if (cmd.includes(SECURITY_PATTERNS.FORK_BOMB)) {
                    return { action: HOOK_ACTIONS.BLOCK, reason: MISSION_MESSAGES.BLOCK_REASON_FORK_BOMB };
                }

                // Prevent Root Deletion (rm -rf /)
                if (SECURITY_PATTERNS.ROOT_DELETION.test(cmd.trim())) {
                    return { action: HOOK_ACTIONS.BLOCK, reason: MISSION_MESSAGES.BLOCK_REASON_ROOT_DELETE };
                }
            }
        }

        return { action: HOOK_ACTIONS.ALLOW };
    }
}
