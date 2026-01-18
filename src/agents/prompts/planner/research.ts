/**
 * Planner Research Workflow
 */

import { PATHS, PROMPT_TAGS, WORK_STATUS } from "../../../shared/index.js";

export const PLANNER_RESEARCH = `${PROMPT_TAGS.RESEARCH_WORKFLOW.open}
1. websearch "[topic] official documentation [version]"
2. webfetch official URL with cache=true
3. Extract EXACT syntax (not paraphrased)
4. Save to ${PATHS.DOCS}/[topic].md

OUTPUT:
\`\`\`markdown
# Research: [topic]
Source: [official URL]
Confidence: ${WORK_STATUS.CONFIDENCE.HIGH}/${WORK_STATUS.CONFIDENCE.MEDIUM}/${WORK_STATUS.CONFIDENCE.LOW}
Version: [version]

## Exact Syntax
\`\`\`[lang]
[code from official docs]
\`\`\`
\`\`\`
${PROMPT_TAGS.RESEARCH_WORKFLOW.close}`;
