
/**
 * Secret Scanner Hook
 * 
 * Scans tool outputs for potential secrets (API Keys, etc) and masks them.
 * This prevents leaking secrets into the context window or logs.
 */

import type { PostToolUseHook, HookContext } from "../types.js";
import { HOOK_ACTIONS, HOOK_NAMES } from "../constants.js";
import { log } from "../../core/agents/logger.js";

const SECRET_PATTERNS = [
    /sk-[a-zA-Z0-9]{20,}T3BlbkFJ/g, // OpenAI-like (example)
    /(AWS|aws|Aws)?[_ ]?(SECRET|secret|Secret)?[_ ]?(KEY|key|Key)[:= ]+[A-Za-z0-9\/+]{40}/g, // AWS Secret Key
    /ghp_[a-zA-Z0-9]{36}/g, // GitHub Personal Access Token
    /xox[baprs]-([0-9a-zA-Z]{10,48})/g // Slack Token
];

export class SecretScannerHook implements PostToolUseHook {
    name = HOOK_NAMES.SECRET_SCANNER;

    async execute(ctx: HookContext, tool: string, input: any, output: { title: string; output: string; metadata: any }) {
        let content = output.output;
        let modified = false;

        for (const pattern of SECRET_PATTERNS) {
            if (pattern.test(content)) {
                content = content.replace(pattern, "********** [SECRET REDACTED] **********");
                modified = true;
            }
        }

        if (modified) {
            return { output: content };
        }
        return {};
    }
}
