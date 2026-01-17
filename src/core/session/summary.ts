/**
 * Context Summary - Generate prompt summaries
 */

import { getMerged } from "./store.js";
import { PATHS } from "../../shared/constants.js";

/**
 * Get context summary for injection into prompts
 */
export function getSummary(sessionId: string): string {
    const context = getMerged(sessionId);
    if (!context) return "";

    const parts: string[] = [];

    if (context.documents.size > 0) {
        parts.push("## Cached Documents");
        for (const doc of context.documents.values()) {
            parts.push(`- ${doc.title}: ${PATHS.DOCS}/${doc.filename}`);
        }
    }

    if (context.findings.length > 0) {
        parts.push("\n## Key Findings");
        for (const finding of context.findings.slice(-10)) {
            parts.push(`- [${finding.category}] ${finding.content}`);
        }
    }

    if (context.decisions.size > 0) {
        parts.push("\n## Decisions Made");
        for (const decision of context.decisions.values()) {
            parts.push(`- Q: ${decision.question}`);
            parts.push(`  A: ${decision.answer}`);
        }
    }

    return parts.join("\n");
}
