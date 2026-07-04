/**
 * Worker Quality Checklist
 * 
 * Adaptive quality checks based on discovered project conventions.
 */

import { AGENT_NAMES, PATHS, PROMPT_TAGS } from "../../../shared/index.js";

export const WORKER_QUALITY = `${PROMPT_TAGS.QUALITY_CHECKLIST.open}
📋 QUALITY CHECKLIST (Adaptive)

Before reporting complete, verify against PROJECT-SPECIFIC standards:

## 1. Static Analysis
- lsp_diagnostics shows NO errors
- Follow linting rules discovered in project (if any)

## 2. Build Verification
- Run the BUILD command from ${PATHS.CONTEXT}
- Must complete without errors

## 3. Test Verification
- Isolated test for your assigned file passed (TDD workflow)
- Run the project's TEST command from ${PATHS.CONTEXT} to confirm no regressions (this complements the isolated test, it does not replace it)
- All tests must pass

## 4. Code Quality (OBSERVE existing patterns)
- Match naming conventions found in codebase
- Match error handling patterns found in codebase
- No debug logging left (console.log, print, logger.debug, etc.)
- No hardcoded values that should be config

## 5. Documentation Compliance
- Implementation matches ${PATHS.DOCS}/ patterns
- API usage matches official documentation

## OUTPUT FORMAT:
\`\`\`
TASK: T[N]
CHANGED: [files] ([lines])
BUILD: [command used] → [result]
TEST: [command used] → [result]  
PATTERNS_FOLLOWED: [list observed conventions]
DOCS_USED: ${PATHS.DOCS}/[file]
Ready for ${AGENT_NAMES.REVIEWER} verification
\`\`\`
${PROMPT_TAGS.QUALITY_CHECKLIST.close}`;

