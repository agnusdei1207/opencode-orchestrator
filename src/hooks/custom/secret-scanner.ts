
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

/** Mask every known credential shape in `text`. */
export function redactSecrets(text: string): string {
    let content = text;
    for (const pattern of SECURITY_PATTERNS.SECRETS) {
        content = content.replace(pattern, MISSION_MESSAGES.SECRET_REDACTED_MSG);
    }
    return content;
}

export class SecretScannerHook implements PostToolUseHook {
    name = HOOK_NAMES.SECRET_SCANNER;

    async execute(_ctx: HookContext, _tool: string, _input: ToolInput, output: ToolOutput): Promise<PostToolResult> {
        const content = redactSecrets(output.output);
        return content === output.output ? {} : { output: content };
    }
}
