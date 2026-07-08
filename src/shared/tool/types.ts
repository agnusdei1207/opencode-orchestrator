/**
 * Tool types and interfaces (consolidated)
 */

import type {
    SessionCreateData,
    SessionCreateResponse,
    SessionMessagesData,
    SessionMessagesResponse,
    SessionPromptData,
    SessionStatusData,
    SessionStatusResponse,
} from "@opencode-ai/sdk";

/**
 * AST Search Result Interface
 */

export interface AstSearchResult {
    file: string;
    line: number;
    column: number;
    content: string;
    context: {
        before: string[];
        after: string[];
    };
}

/**
 * AST Replace Result Interface
 */

export interface AstReplaceResult {
    file: string;
    success: boolean;
    error?: string;
}

/**
 * LSP Diagnostic Interface
 */

export interface LspDiagnostic {
    file: string;
    line: number;
    column: number;
    severity: number;
    message: string;
    source?: string;
}

/**
 * LSP Rename Location Interface
 */

export interface LspRenameLocation {
    file: string;
    line: number;
    column: number;
    oldText: string;
}

/**
 * LSP Rename Result Interface
 */


export interface LspRenameResult {
    success: boolean;
    locations: LspRenameLocation[];
    error?: string;
}

/**
 * LSP Command Result Interface
 */

export interface LspCommandResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

/**
 * Poll Result Interface
 */

export interface PollResult {
    success: boolean;
    timedOut: boolean;
    aborted?: boolean;
    error?: string;
    pollCount: number;
    elapsedMs: number;
}

/**
 * Session Client Interface
 */

export interface SessionClient {
    create: (opts: Omit<SessionCreateData, "url">) => Promise<{ data?: SessionCreateResponse; error?: unknown }>;
    prompt: (opts: Omit<SessionPromptData, "url">) => Promise<{ error?: unknown }>;
    messages: (opts: Omit<SessionMessagesData, "url">) => Promise<{ data?: SessionMessagesResponse; error?: unknown }>;
    status: (opts?: Omit<SessionStatusData, "url">) => Promise<{ data?: SessionStatusResponse; error?: unknown }>;
}
