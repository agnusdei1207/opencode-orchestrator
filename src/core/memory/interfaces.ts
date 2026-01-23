/**
 * Hierarchical Memory System Interfaces
 */

export enum MemoryLevel {
    /** Core rules, identity, and system instructions (Highest permanence) */
    SYSTEM = "system",
    /** Project architecture, tech stack, and long-term findings (High permanence) */
    PROJECT = "project",
    /** Mission goals, TODO progress, and mid-term decisions (Medium permanence) */
    MISSION = "mission",
    /** Current task details, short-term findings, and tool outputs (Low permanence) */
    TASK = "task",
}

export interface MemoryEntry {
    id: string;
    level: MemoryLevel;
    content: string;
    timestamp: number;
    metadata?: Record<string, any>;
    importance: number; // 0 to 1
}

export interface MemorySnapshot {
    [MemoryLevel.SYSTEM]: MemoryEntry[];
    [MemoryLevel.PROJECT]: MemoryEntry[];
    [MemoryLevel.MISSION]: MemoryEntry[];
    [MemoryLevel.TASK]: MemoryEntry[];
}

export interface MemoryConfig {
    /** Token budget per level (approximate or percentage) */
    tokenBudgets: Record<MemoryLevel, number>;
    /** Enable dynamic relevance filtering */
    enableRelevanceFiltering: boolean;
}
