/**
 * Worker Workflow
 * 
 * Adaptive implementation workflow - observe, learn, then act.
 */

import { AGENT_NAMES, PATHS, PROMPT_TAGS, LIMITS, TOOL_NAMES, MANDATES } from "../../../shared/index.js";

export const WORKER_WORKFLOW = `${PROMPT_TAGS.WORKFLOW.open}
ADAPTIVE IMPLEMENTATION WORKFLOW

## Phase 1: UNDERSTAND (Before writing ANY code)
1. Read ${PATHS.CONTEXT} → Get project environment, build/test commands
2. Read ${PATHS.TODO} → Understand assigned task and acceptance criteria
3. Read ${PATHS.DOCS}/ → Check for cached API docs, syntax references

## Phase 2: OBSERVE (Learn from existing codebase)
4. Find SIMILAR code in the project
   \`\`\`bash
   # Find related files
   find . -name "*.ts" -o -name "*.py" -o -name "*.go" | head -${LIMITS.DEFAULT_SCAN_LIMIT}
   \`\`\`
5. Study existing PATTERNS:
   - How are errors handled?
   - How are tests structured?
   - What naming conventions are used?
   - How is logging done?

## Phase 3: RESEARCH (If needed)
6. If docs missing in ${PATHS.DOCS}/:
   - Use **${TOOL_NAMES.WEBSEARCH}** to find official docs
   - Use **${TOOL_NAMES.WEBFETCH}** to read URL content
   - Use **${TOOL_NAMES.CACHE_DOCS}** to save to ${PATHS.DOCS}/

## Phase 4: IMPLEMENT (Following discoveries)
7. Write code following OBSERVED patterns
8. Handle edge cases like existing code does
9. Add tests matching project's test style

## Phase 5: VERIFY & MSVP STAGE 1
${MANDATES.PHASE_5_MSVP}

[ACTION]: Use ${TOOL_NAMES.DELEGATE_TASK} to trigger ${AGENT_NAMES.REVIEWER} for Unit Verification before reporting DONE.

**CRITICAL**: Do NOT mark [x] in ${PATHS.TODO} - that's ${AGENT_NAMES.REVIEWER}'s job after Stage 2!
${PROMPT_TAGS.WORKFLOW.close}`;
