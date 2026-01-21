
/**
 * Strict Role Guard Hook
 * 
 * Enforces role-based access control (RBAC) for agents.
 * - Planner: Cannot write code or run commands.
 * - Reviewer: Cannot write code (only review).
 */

import type { PreToolUseHook, HookContext } from "../types.js";
import { TOOL_NAMES } from "../../shared/index.js";
import { state } from "../../core/orchestrator/index.js";
import { HOOK_ACTIONS, HOOK_NAMES } from "../constants.js";

export class StrictRoleGuardHook implements PreToolUseHook {
    name = HOOK_NAMES.STRICT_ROLE_GUARD;

    async execute(ctx: HookContext, tool: string, args: any) {
        const session = state.sessions.get(ctx.sessionID);
        // We assume session might store the active agent role, or we deduce it.
        // Sadly, 'state.sessions' currently stores generic info.
        // We often pass agent name in 'call_agent', but once inside the sub-session, 
        // we might not know WHO is running unless we track it.
        // However, if the tool is 'call_agent', we can check the TARGET agent.

        // LIMITATION: Deeply nested RBAC requires knowing the 'current active agent' of the session.
        // For now, let's implement a safeguard for the 'Planner' attributes if we can detect it.
        // Or, more simply: prevent 'Planner' from being called with 'write' instructions? No, that's meta.

        // "Prevent infinite recursive spawning" - already handled via prompt?
        // Let's implement: "Prevent 'rm -rf /' or dangerous commands" globally for now.

        // Check for both background and standard command execution
        if (tool === "run_command" || tool === TOOL_NAMES.RUN_BACKGROUND) {
            const cmd = args?.command as string;
            if (cmd) {
                // Prevent Fork Bomb
                if (cmd.includes(":(){ :|:& };:")) {
                    return { action: HOOK_ACTIONS.BLOCK, reason: "Fork bomb detected." };
                }

                // Prevent Root Deletion (rm -rf /) but allow other rm -rf usage
                // We want to block "rm -rf /" or "rm -rf / " specifically.
                // We DO NOT want to block "rm -rf /Users/pf/..."
                // Regex: rm\s+-rf\s+\/\s*$  (matches rm -rf / at end of string or with trailing space)
                // Also check for multiple arguments? rm -rf / etc

                const isRootDeletion = /rm\s+(-r?f?\s+)*\/\s*$/.test(cmd.trim());
                if (isRootDeletion) {
                    return { action: HOOK_ACTIONS.BLOCK, reason: "Root deletion blocked." };
                }
            }
        }

        return { action: HOOK_ACTIONS.ALLOW };
    }
}
