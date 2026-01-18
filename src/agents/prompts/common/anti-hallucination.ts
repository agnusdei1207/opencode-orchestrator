/**
 * Anti-Hallucination Rules
 * 
 * Core rules to prevent LLM from making up information.
 */

import { PATHS, PROMPT_TAGS, WORK_STATUS } from "../../../shared/index.js";

export const ANTI_HALLUCINATION_CORE = `${PROMPT_TAGS.ANTI_HALLUCINATION.open}
 ZERO TOLERANCE FOR GUESSING

BEFORE ANY IMPLEMENTATION:
1. Check ${PATHS.DOCS}/ for cached documentation
2. If not found → websearch for OFFICIAL docs
3. webfetch with cache=true
4. Use EXACT syntax from docs

TRUSTED SOURCES ONLY:
- Official docs: docs.[framework].com
- GitHub: github.com/[org]/[repo]
- Package registries: npmjs.com, pypi.org

 FORBIDDEN:
- Inventing function signatures
- Assuming API compatibility
- Guessing version-specific syntax
- Using outdated knowledge

 REQUIRED:
- Source URL for every claim
- Confidence level: ${WORK_STATUS.CONFIDENCE.HIGH} (official) / ${WORK_STATUS.CONFIDENCE.MEDIUM} (github) / ${WORK_STATUS.CONFIDENCE.LOW} (blog)
- Say "NOT FOUND" if documentation unavailable
${PROMPT_TAGS.ANTI_HALLUCINATION.close}`;
