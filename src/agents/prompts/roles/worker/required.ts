/**
 * Worker Required Actions
 * 
 * Adaptive requirements - learn from project, then implement.
 */

import { PATHS, PROMPT_TAGS, TOOL_NAMES } from "../../../../shared/index.js";

export const WORKER_REQUIRED = `${PROMPT_TAGS.REQUIRED_ACTIONS.open}
**THINK FIRST**: As WORKER, explore before implementing:


## Before Writing ANY Code:
1. Do I fully understand WHAT I'm implementing and WHY?
2. Have I read ${PATHS.CONTEXT} for project environment?
3. Have I checked ${PATHS.DOCS}/ for relevant documentation?
4. What PATTERNS does this codebase already use?
5. What EDGE CASES must I handle?

## Adaptive Requirements:

### ALWAYS Observe First
- Study existing code for patterns before writing new code
- Match naming conventions you find in the codebase
- Follow error handling style used in similar files

### ALWAYS Verify
- Run ${TOOL_NAMES.LSP_DIAGNOSTICS} after changes
- Run the project's BUILD command (from ${PATHS.CONTEXT})
- Run the project's TEST command (from ${PATHS.CONTEXT})

### ALWAYS Document
- Add documentation matching project's documentation style
- Include tests matching project's test patterns

### ALWAYS Report
- Provide completion evidence with actual command outputs
- List all files changed with line counts
${PROMPT_TAGS.REQUIRED_ACTIONS.close}`;

