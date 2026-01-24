/**
 * LSP Tools Prompt (Common)
 */

import { TOOL_NAMES, PROMPT_TAGS, wrapTag } from "../../../shared/index.js";

export const SHARED_LSP_TOOLS = wrapTag(PROMPT_TAGS.LSP_TOOLS, `
### LSP (Language Server Protocol) Tools
- \`${TOOL_NAMES.LSP_DIAGNOSTICS}\`: Find type errors, syntax issues, and lint warnings.

**Rules**:
- **Verification**: ALWAYS run \`${TOOL_NAMES.LSP_DIAGNOSTICS}({ file: "*" })\` before marking a task or TODO as complete.`);
