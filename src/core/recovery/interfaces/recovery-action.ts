/**
 * Recovery Action Type
 */

export type RecoveryAction =
    | { type: "retry"; delay: number; attempt: number }
    | { type: "skip"; reason: string }
    | { type: "escalate"; to: string; reason: string }
    | { type: "resume"; sessionId: string }
    | { type: "compact"; reason: string }
    | { type: "abort"; reason: string };
