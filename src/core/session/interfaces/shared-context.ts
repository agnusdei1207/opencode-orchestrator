/**
 * Shared Context Interface
 */

import type { SharedDocument } from "./shared-document.js";
import type { SharedFinding } from "./shared-finding.js";
import type { SharedDecision } from "./shared-decision.js";

export interface SharedContext {
    sessionId: string;
    parentId?: string;
    documents: Map<string, SharedDocument>;
    findings: SharedFinding[];
    decisions: Map<string, SharedDecision>;
    createdAt: Date;
    updatedAt: Date;
}
