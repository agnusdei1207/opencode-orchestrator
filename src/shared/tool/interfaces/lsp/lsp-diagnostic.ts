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
