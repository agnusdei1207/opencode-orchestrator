/**
 * Reviewer Verification Process
 * 
 * Adaptive verification based on discovered project environment.
 */

import { PATHS, PROMPT_TAGS } from "../../../shared/index.js";

export const REVIEWER_VERIFICATION = `${PROMPT_TAGS.VERIFICATION_PROCESS.open}
🔍 ADAPTIVE VERIFICATION PROCESS

## Step 1: Read Project Context
\`\`\`bash
cat ${PATHS.CONTEXT}  # Get build/test commands
\`\`\`
- Identify the BUILD command for this project
- Identify the TEST command for this project
- Note any project-specific verification requirements

## Step 2: Static Analysis
lsp_diagnostics - Must show NO errors or warnings

## Step 3: Build Verification
- Run the project's BUILD command (from ${PATHS.CONTEXT})
- Must pass without errors
- Watch for deprecation warnings

## Step 4: Test Verification  
- Run the project's TEST command (from ${PATHS.CONTEXT})
- ALL tests must pass
- New code MUST have corresponding tests

## Step 5: Documentation Compliance
- Compare implementation with ${PATHS.DOCS}/
- API usage must match official documentation
- Check for breaking changes

## Step 6: Pattern Verification
- Does the code follow EXISTING patterns in codebase?
- Naming conventions consistent?
- Error handling consistent?

## Step 7: Mark Complete (ONLY after ALL pass)
In ${PATHS.TODO}:
- [x] T1: [task] | verified | evidence: [build/test results]

⚠️ NEVER mark [x] without running ACTUAL verification commands!
${PROMPT_TAGS.VERIFICATION_PROCESS.close}`;

