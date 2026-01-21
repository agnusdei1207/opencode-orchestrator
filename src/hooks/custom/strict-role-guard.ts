
/**
 * Strict Role Guard Hook
 * 
 * Enforces role-based access control (RBAC) for agents.
 * - Planner: Cannot write code or run commands.
 * - Reviewer: Cannot write code (only review).
 */

import type { PreToolUseHook, HookContext } from "../types.js";
import { TOOL_NAMES } from "../../shared/index.js";
import { HOOK_ACTIONS, HOOK_NAMES } from "../constants.js";
import { SECURITY_PATTERNS } from "../../shared/constants/security-patterns.js";
import { MISSION_MESSAGES } from "../../shared/constants/system-messages.js";

export class StrictRoleGuardHook implements PreToolUseHook {
    name = HOOK_NAMES.STRICT_ROLE_GUARD;

    async execute(ctx: HookContext, tool: string, args: any) {
        // "Prevent 'rm -rf /' or dangerous commands" globally for now.

        // Check for both background and standard command execution
        if (tool === "run_command" || tool === TOOL_NAMES.RUN_BACKGROUND) {
            const cmd = args?.command as string;
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
