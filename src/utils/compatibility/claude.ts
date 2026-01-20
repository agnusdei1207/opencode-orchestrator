import fs from "fs";
import path from "path";
import { log } from "../../core/agents/logger.js";

/**
 * Find and read CLAUDE.md guidelines.
 * Follows Claude Code's discovery logic:
 * 1. CLAUDE.md in current directory or parents
 * 2. .github/instructions/ *.md (checking main ones)
 * 3. .cursor/rules/ *.md
 * 4. .claude/rules/ *.md
 */
export function findClaudeRules(startDir: string = process.cwd()): string | null {
    try {
        // 1. Check for CLAUDE.md (upwards)
        let currentDir = startDir;
        const root = path.parse(startDir).root;

        while (true) {
            const claudeMdPath = path.join(currentDir, "CLAUDE.md");
            if (fs.existsSync(claudeMdPath)) {
                try {
                    const content = fs.readFileSync(claudeMdPath, "utf-8");
                    log(`[compatibility] Loaded CLAUDE.md from ${claudeMdPath}`);
                    return formatRules("CLAUDE.md", content);
                } catch (e) {
                    log(`[compatibility] Error reading CLAUDE.md: ${e}`);
                }
            }

            if (currentDir === root) break;
            currentDir = path.dirname(currentDir);
        }

        // 2. If no CLAUDE.md, check for other rule files in the *current* project root
        // (Assuming startDir is project root for simplicity in this plugin Context)

        // .github/copilot-instructions.md
        const copilotPath = path.join(startDir, ".github", "copilot-instructions.md");
        if (fs.existsSync(copilotPath)) {
            return formatRules("Copilot Instructions", fs.readFileSync(copilotPath, "utf-8"));
        }

        return null;
    } catch (error) {
        log(`[compatibility] Error finding Claude rules: ${error}`);
        return null;
    }
}

function formatRules(source: string, content: string): string {
    return `
<project_rules source="${source}">
${content}
</project_rules>

<claude_compatibility>
These rules are from the project's ${source}. 
You MUST follow them as strictly as if they were your system prompt.
This plugin runs in "Claude Code Compatibility Mode".
</claude_compatibility>
`;
}
