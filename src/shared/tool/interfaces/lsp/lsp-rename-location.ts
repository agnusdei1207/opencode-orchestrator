/**
 * LSP Rename Location Interface
 */

export interface LspRenameLocation {
    file: string;
    line: number;
    column: number;
    oldText: string;
}
