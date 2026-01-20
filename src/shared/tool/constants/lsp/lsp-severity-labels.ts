/**
 * LSP Severity Labels Constant
 */

import { TOOL_LABEL } from "../common/labels.js";
import { LSP_SEVERITY } from "./lsp-severity.js";

export const LSP_SEVERITY_LABELS = {
    [LSP_SEVERITY.ERROR]: TOOL_LABEL.ERROR,
    [LSP_SEVERITY.WARNING]: TOOL_LABEL.WARNING,
    [LSP_SEVERITY.INFO]: TOOL_LABEL.INFO,
    [LSP_SEVERITY.HINT]: TOOL_LABEL.HINT,
} as const;

