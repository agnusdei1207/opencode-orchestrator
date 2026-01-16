/**
 * Session Shared Context
 * 
 * Enables context sharing between parent and child sessions
 * Useful for passing research findings, decisions, and cached documents
 */

export interface SharedDocument {
    url: string;
    filename: string;
    title: string;
    cachedAt: Date;
}

export interface SharedFinding {
    id: string;
    content: string;
    source: string;
    timestamp: Date;
    category: "pattern" | "api" | "config" | "warning" | "decision";
}

export interface SharedDecision {
    id: string;
    question: string;
    answer: string;
    rationale: string;
    decidedAt: Date;
}

export interface SharedContext {
    sessionId: string;
    parentId?: string;
    documents: Map<string, SharedDocument>;
    findings: SharedFinding[];
    decisions: Map<string, SharedDecision>;
    createdAt: Date;
    updatedAt: Date;
}

// Global context store
const contexts = new Map<string, SharedContext>();

// Parent-child relationships
const parentChildMap = new Map<string, Set<string>>();

/**
 * Create a new shared context for a session
 */
export function create(sessionId: string, parentId?: string): SharedContext {
    const context: SharedContext = {
        sessionId,
        parentId,
        documents: new Map(),
        findings: [],
        decisions: new Map(),
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    contexts.set(sessionId, context);

    // Track parent-child relationship
    if (parentId) {
        if (!parentChildMap.has(parentId)) {
            parentChildMap.set(parentId, new Set());
        }
        parentChildMap.get(parentId)!.add(sessionId);
    }

    return context;
}

/**
 * Get shared context for a session
 * If session has a parent, merges parent context
 */
export function get(sessionId: string): SharedContext | undefined {
    return contexts.get(sessionId);
}

/**
 * Get merged context (includes parent context)
 */
export function getMerged(sessionId: string): SharedContext | undefined {
    const context = contexts.get(sessionId);
    if (!context) return undefined;

    if (!context.parentId) return context;

    const parentContext = contexts.get(context.parentId);
    if (!parentContext) return context;

    // Merge parent context into child
    const merged: SharedContext = {
        ...context,
        documents: new Map([...parentContext.documents, ...context.documents]),
        findings: [...parentContext.findings, ...context.findings],
        decisions: new Map([...parentContext.decisions, ...context.decisions]),
    };

    return merged;
}

/**
 * Add a document to the shared context
 */
export function addDocument(sessionId: string, doc: SharedDocument): void {
    const context = contexts.get(sessionId);
    if (!context) return;

    context.documents.set(doc.filename, doc);
    context.updatedAt = new Date();
}

/**
 * Add a finding to the shared context
 */
export function addFinding(sessionId: string, finding: Omit<SharedFinding, "id" | "timestamp">): void {
    const context = contexts.get(sessionId);
    if (!context) return;

    context.findings.push({
        ...finding,
        id: `finding_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date(),
    });
    context.updatedAt = new Date();
}

/**
 * Record a decision
 */
export function addDecision(sessionId: string, decision: Omit<SharedDecision, "id" | "decidedAt">): void {
    const context = contexts.get(sessionId);
    if (!context) return;

    const id = `decision_${Date.now()}`;
    context.decisions.set(id, {
        ...decision,
        id,
        decidedAt: new Date(),
    });
    context.updatedAt = new Date();
}

/**
 * Get all child session IDs
 */
export function getChildren(parentId: string): string[] {
    return Array.from(parentChildMap.get(parentId) || []);
}

/**
 * Clear context for a session
 */
export function clear(sessionId: string): void {
    const context = contexts.get(sessionId);
    if (context?.parentId) {
        parentChildMap.get(context.parentId)?.delete(sessionId);
    }
    contexts.delete(sessionId);
}

/**
 * Clear all contexts
 */
export function clearAll(): void {
    contexts.clear();
    parentChildMap.clear();
}

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
            parts.push(`- ${doc.title}: .cache/docs/${doc.filename}`);
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

/**
 * Get stats
 */
export function getStats(): {
    totalContexts: number;
    totalDocuments: number;
    totalFindings: number;
    totalDecisions: number;
} {
    let totalDocuments = 0;
    let totalFindings = 0;
    let totalDecisions = 0;

    for (const context of contexts.values()) {
        totalDocuments += context.documents.size;
        totalFindings += context.findings.length;
        totalDecisions += context.decisions.size;
    }

    return {
        totalContexts: contexts.size,
        totalDocuments,
        totalFindings,
        totalDecisions,
    };
}
