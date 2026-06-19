/**
 * Tool types and interfaces (consolidated)
 */

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
    error?: string;
    pollCount: number;
    elapsedMs: number;
}

/**
 * Session Client Interface
 */

export interface SessionClient {
    create: (opts: { body: { parentID: string; title: string }; query: { directory: string } }) => Promise<{ data?: { id: string }; error?: string }>;
    prompt: (opts: { path: { id: string }; body: { agent: string; tools?: Record<string, boolean>; parts: { type: string; text: string }[] } }) => Promise<{ error?: string }>;
    messages: (opts: { path: { id: string } }) => Promise<{ data?: unknown[]; error?: string }>;
    status: () => Promise<{ data?: Record<string, { type: string }> }>;
}

