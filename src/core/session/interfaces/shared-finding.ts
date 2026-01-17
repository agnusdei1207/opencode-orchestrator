/**
 * Shared Finding Interface
 */

export interface SharedFinding {
    id: string;
    content: string;
    source: string;
    timestamp: Date;
    category: "pattern" | "api" | "config" | "warning" | "decision";
}
