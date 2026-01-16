/**
 * Shared Context Interfaces
 */

/**
 * Cached document reference
 */
export interface SharedDocument {
    url: string;
    filename: string;
    title: string;
    cachedAt: Date;
}

/**
 * Research finding
 */
export interface SharedFinding {
    id: string;
    content: string;
    source: string;
    timestamp: Date;
    category: "pattern" | "api" | "config" | "warning" | "decision";
}

/**
 * Decision record
 */
export interface SharedDecision {
    id: string;
    question: string;
    answer: string;
    rationale: string;
    decidedAt: Date;
}

/**
 * Complete shared context
 */
export interface SharedContext {
    sessionId: string;
    parentId?: string;
    documents: Map<string, SharedDocument>;
    findings: SharedFinding[];
    decisions: Map<string, SharedDecision>;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Context statistics
 */
export interface ContextStats {
    totalContexts: number;
    totalDocuments: number;
    totalFindings: number;
    totalDecisions: number;
}
