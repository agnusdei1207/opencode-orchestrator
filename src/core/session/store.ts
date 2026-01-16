/**
 * Context Store - Session context data management
 */

import type { SharedContext, SharedDocument, SharedFinding, SharedDecision, ContextStats } from "./interfaces.js";

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
 * Get stats
 */
export function getStats(): ContextStats {
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
