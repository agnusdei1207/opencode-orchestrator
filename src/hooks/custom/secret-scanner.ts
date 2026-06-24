
/**
 * Secret Scanner Hook
 * 
 * Scans tool outputs for potential secrets (API Keys, etc) and masks them.
 * This prevents leaking secrets into the context window or logs.
 */

import type { PostToolUseHook, HookContext, PostToolResult, ToolInput, ToolOutput } from "../registry.js";
import { HOOK_NAMES } from "../constants.js";
import { SECURITY_PATTERNS } from "../../shared/constants/security-patterns.js";
import { MISSION_MESSAGES } from "../../shared/constants/system-messages.js";

export class SecretScannerHook implements PostToolUseHook {
    name = HOOK_NAMES.SECRET_SCANNER;

    async execute(ctx: HookContext, tool: string, input: ToolInput, output: ToolOutput): Promise<PostToolResult> {
        let content = output.output;
        let modified = false;

        for (const pattern of SECURITY_PATTERNS.SECRETS) {
            if (pattern.test(content)) {
                content = content.replace(pattern, MISSION_MESSAGES.SECRET_REDACTED_MSG);
                modified = true;
            }
        }

        if (modified) {
            return { output: content };
        }
        return {};
    }
}
