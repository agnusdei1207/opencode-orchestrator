/**
 * WAL (Write-Ahead Log) Action constants
 */

export const WAL_ACTIONS = {
    LAUNCH: "LAUNCH",
    UPDATE: "UPDATE",
    COMPLETE: "COMPLETE",
    DELETE: "DELETE",
} as const;

export type WALAction = typeof WAL_ACTIONS[keyof typeof WAL_ACTIONS];
