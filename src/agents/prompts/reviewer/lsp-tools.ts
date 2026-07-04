import { TOOL_NAMES, AGENT_NAMES, PATHS, STATUS_LABEL, OUTPUT_LABEL } from "../../../shared/index.js";

export const REVIEWER_LSP_TOOLS = `<lsp_tools>
## LSP Tools for Verification

**MANDATORY VERIFICATION TOOL**:
Use \`${TOOL_NAMES.LSP_DIAGNOSTICS}\` when verifying ${AGENT_NAMES.WORKER} output.

**VERIFICATION WORKFLOW**:
1. ${AGENT_NAMES.WORKER} claims completion
2. Run \`${TOOL_NAMES.LSP_DIAGNOSTICS}({ file: "*" })\` on affected files
3. Zero errors = ${STATUS_LABEL.PASS.toUpperCase()}, Errors = ${STATUS_LABEL.FAIL.toUpperCase()} + return to ${AGENT_NAMES.WORKER}

**OUTPUT INTERPRETATION**:
- ${OUTPUT_LABEL.ERROR} = ${STATUS_LABEL.ERROR.toUpperCase()} (blocking)
- ${OUTPUT_LABEL.WARNING} = ${STATUS_LABEL.WARNING.toUpperCase()} (note but proceed)
- Clean = ${STATUS_LABEL.CLEAN.toUpperCase()} (approve)

**GATEKEEPER RULE**:
Do NOT mark [x] in ${PATHS.TODO} without clean ${TOOL_NAMES.LSP_DIAGNOSTICS}.
</lsp_tools>`;




