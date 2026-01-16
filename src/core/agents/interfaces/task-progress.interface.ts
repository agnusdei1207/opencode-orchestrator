/**
 * TaskProgress Interface
 */

export interface TaskProgress {
    toolCalls: number;
    lastTool?: string;
    lastMessage?: string;
    lastUpdate: Date;
}
