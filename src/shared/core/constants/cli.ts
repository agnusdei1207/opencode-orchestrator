/**
 * CLI Tool Names
 */

export const CLI_NAME = {
    NPX: "npx",
    TSC: "tsc",
    ESLINT: "eslint",
    RG: "rg",
    SED: "sed",
    AST_GREP: "ast-grep",
    GIT: "git",
    JQ: "jq",
    NODE: "node",
    SH: "sh",
} as const;

/**
 * Node Process Events
 */
export const PROC_EVENT = {
    CLOSE: "close",
    ERROR: "error",
    EXIT: "exit",
    DATA: "data",
    MESSAGE: "message",
    DISCONNECT: "disconnect",
} as const;
