/**
 * LSP Command Result Interface
 */

export interface LspCommandResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}
