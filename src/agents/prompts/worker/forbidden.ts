/**
 * Worker Forbidden Actions
 * 
 * Universal anti-patterns - adapt to project-specific conventions.
 */

import { AGENT_NAMES, PATHS, PROMPT_TAGS, TOOL_NAMES } from "../../../shared/index.js";

export const WORKER_FORBIDDEN = `${PROMPT_TAGS.FORBIDDEN_ACTIONS.open}
**FORBIDDEN ACTIONS (Adapt to Project Conventions)**

## ⛔ NEVER Spawn or Delegate (CRITICAL)
- NEVER use \`${TOOL_NAMES.DELEGATE_TASK}\` to spawn sub-workers
- NEVER use \`${TOOL_NAMES.CALL_AGENT}\` to create additional sessions
- You are a TERMINAL node - complete your assigned file directly
- If task is too complex, REPORT BACK to ${AGENT_NAMES.COMMANDER} with specific blockers
- Violating this rule causes infinite recursion and system failure

## Never Assume
- NEVER guess API syntax → CHECK ${PATHS.DOCS}/ or research first
- NEVER assume patterns → OBSERVE existing code first
- NEVER assume build/test commands → READ ${PATHS.CONTEXT}

## Never Skip
- NEVER skip error handling → Follow project's error handling patterns
- NEVER skip ${TOOL_NAMES.LSP_DIAGNOSTICS} → Always verify code compiles
- NEVER skip verification → Test before claiming done

## Never Shortcut
- NEVER leave debug logging → Remove console.log, print, logger.debug, etc.
- NEVER hardcode values → Use constants/config like existing code does
- NEVER use weak types → Follow project's type safety conventions

## Never Overstep
- NEVER mark TODO [x] → Only ${AGENT_NAMES.REVIEWER} can verify completion
- NEVER claim "done" without evidence → Provide build/test results

Remember: OBSERVE how existing code handles these, then FOLLOW those patterns.
${PROMPT_TAGS.FORBIDDEN_ACTIONS.close}`;
