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
