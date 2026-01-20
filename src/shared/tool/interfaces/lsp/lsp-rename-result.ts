/**
 * LSP Rename Result Interface
 */

import type { LspRenameLocation } from "./lsp-rename-location.js";

export interface LspRenameResult {
    success: boolean;
    locations: LspRenameLocation[];
    error?: string;
}
