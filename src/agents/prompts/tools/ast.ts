/**
 * AST Tools Prompt (Common)
 */

import { TOOL_NAMES } from "../../../shared/index.js";

export const SHARED_AST_TOOLS = `<ast_tools>
### AST (Structural) Tools
- \`${TOOL_NAMES.AST_SEARCH}\`: Find code by syntax patterns (e.g., finding all function calls with specific arguments).
- \`${TOOL_NAMES.AST_REPLACE}\`: Perform structural refactoring using syntax patterns.

**Pattern Syntax**:
- \`$VAR\`: Matches a single identifier/node.
- \`$$$ARGS\`: Matches multiple elements or statements.
- \`___ \`: Wildcard for any node.

**Usage Guidelines**:
- Use **AST** when you need to find or change code based on its logical structure where regex is too blunt.
- Always verify structural changes with \`${TOOL_NAMES.LSP_DIAGNOSTICS}\`.
</ast_tools>`;

