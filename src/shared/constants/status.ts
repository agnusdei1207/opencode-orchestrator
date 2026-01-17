/**
 * Status and Emoji
 */

export const AGENT_EMOJI: Record<string, string> = {
    Commander: "C",
    Planner: "P",
    Worker: "W",
    Reviewer: "R",
} as const;

export const STATUS_EMOJI = {
    pending: "...",
    running: "RUN",
    completed: "OK",
    done: "OK",
    error: "ERR",
    timeout: "TIM",
    cancelled: "CAN",
} as const;

export type TaskStatus = keyof typeof STATUS_EMOJI;

export function getStatusEmoji(status: string): string {
    return STATUS_EMOJI[status as TaskStatus] ?? "?";
}
