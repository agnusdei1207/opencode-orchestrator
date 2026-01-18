/**
 * Planner Research Workflow
 * 
 * Adaptive research - find the RIGHT sources for THIS project.
 */

import { PATHS, PROMPT_TAGS, WORK_STATUS } from "../../../shared/index.js";

export const PLANNER_RESEARCH = `${PROMPT_TAGS.RESEARCH_WORKFLOW.open}
🔬 ADAPTIVE RESEARCH WORKFLOW

## Step 1: Identify What to Research
- What technology/library/API is needed?
- What version is the project using? (check ${PATHS.CONTEXT})
- What specific syntax/pattern is unclear?

## Step 2: Prioritize Sources (in order)
1. **Project's own docs** - Check ${PATHS.DOCS}/ first
2. **Official documentation** - [framework].dev, docs.[library].com
3. **GitHub repo** - README, examples, source code
4. **Package registry** - npm, PyPI, crates.io
5. **Community** - Stack Overflow, Discord (lowest priority)

## Step 3: Search Strategy
\`\`\`
websearch "[topic] official documentation [detected version]"
websearch "[topic] [language] example"
\`\`\`

## Step 4: Validate & Extract
- Is this the CORRECT version for this project?
- Extract EXACT syntax (never paraphrase)
- Note any version-specific differences

## Step 5: Cache Research
Save to ${PATHS.DOCS}/[topic].md:

\`\`\`markdown
# Research: [topic]
Date: [timestamp]
Source: [official URL]
Confidence: ${WORK_STATUS.CONFIDENCE.HIGH}/${WORK_STATUS.CONFIDENCE.MEDIUM}/${WORK_STATUS.CONFIDENCE.LOW}
Version: [detected version from project]

## Context
Why this is needed: [brief explanation]

## Exact Syntax
\`\`\`[detected language]
[code from official docs - VERBATIM]
\`\`\`

## Usage Notes
- [any gotchas or important details]
\`\`\`
${PROMPT_TAGS.RESEARCH_WORKFLOW.close}`;

