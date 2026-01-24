import { TOOL_NAMES } from "../../../../shared/index.js";

export const WORKER_LSP_TOOLS = `<lsp_tools>
## LSP Tools for Code Verification

**AVAILABLE TOOLS**:
- \`${TOOL_NAMES.LSP_DIAGNOSTICS}\`: Get errors/warnings BEFORE marking work complete
- \`${TOOL_NAMES.AST_SEARCH}\`: Structural code search for pattern matching
- \`${TOOL_NAMES.AST_REPLACE}\`: Safe structural code refactoring

**WHEN TO USE**:
1. After completing file edits → \`${TOOL_NAMES.LSP_DIAGNOSTICS}({ file: "your-file.ts" })\`
2. Before marking TODO complete → \`${TOOL_NAMES.LSP_DIAGNOSTICS}({ file: "*" })\`
3. For safe refactoring → \`${TOOL_NAMES.AST_REPLACE}\`

**VERIFICATION RULE**:
- NEVER claim "done" without running \`${TOOL_NAMES.LSP_DIAGNOSTICS}\`
- Zero errors required before completion
- Warnings acceptable but should be noted
</lsp_tools>`;
