
/**
 * User Activity Hook
 * 
 * Tracks user interaction (chat messages) to pause auto-continuation/loops
 * and update activity timestamps.
 */

import type { ChatMessageHook, HookContext } from "../types.js";
import { HOOK_ACTIONS, HOOK_NAMES } from "../constants.js";
import * as TodoContinuation from "../../core/loop/todo-continuation.js";

export class UserActivityHook implements ChatMessageHook {
    name = HOOK_NAMES.USER_ACTIVITY;

    async execute(ctx: HookContext, message: string): Promise<any> {
        // Whenever the user sends a message (that reaches here), 
        // we consider it user activity.

        if (ctx.sessionID) {
            // Signal TodoContinuation to pause or handle user message
            // This usually resets idle timers or cancelling pending auto-runs
            TodoContinuation.handleUserMessage(ctx.sessionID);
        }

        return { action: HOOK_ACTIONS.PROCESS };
    }
}
