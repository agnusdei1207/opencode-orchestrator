/**
 * Prompt-related constants
 */

// ============================================================================
// Reasoning Constraints
// ============================================================================

export const REASONING_CONSTRAINTS = `
<constraints>
1. Reasoning MUST be in English for maximum stability
2. If reasoning collapses into gibberish, stop and output: "ERROR: REASONING_COLLAPSE"
3. Never suppress type errors with 'as any', '@ts-ignore', '@ts-expect-error'
4. Never leave code in broken state
5. Always verify with evidence before claiming completion
</constraints>
`;

// ============================================================================
// Language Rules
// ============================================================================

export const LANGUAGE_RULE = `
<language_rule>
THINK and REASON in English for maximum model stability.

FINAL RESPONSE LANGUAGE:
- Detect user's language from their request
- Respond in SAME language
- Korean → Korean, English → English, Japanese → Japanese, Chinese → Chinese
- Default to English if unclear
</language_rule>
`;

// ============================================================================
// Task Completion Criteria
// ============================================================================

export const TASK_COMPLETION_CHECK = `
<completion_criteria>
A task is COMPLETE when:
1. ✅ All planned work done
2. ✅ lsp_diagnostics clean on changed files
3. ✅ Build passes (if applicable)
4. ✅ Tests pass (if applicable)
5. ✅ User's original request fully addressed
</completion_criteria>
`;

// ============================================================================
// Output Format
// ============================================================================

export const OUTPUT_FORMAT = `
<output_format>
Report completion with:
- What was done (concise)
- Evidence of success (build/test/audit results)
- Files changed (with line numbers)
</output_format>
`;

// ============================================================================
// Anti-Patterns
// ============================================================================

export const ANTI_PATTERNS = `
<anti_patterns>
❌ Delegate without environment/codebase context
❌ Leave code broken or with LSP errors
❌ Make random changes without understanding root cause
❌ Use 'as any', '@ts-ignore', or '@ts-expect-error'
❌ Suppress errors instead of fixing them
</anti_patterns>
`;

// ============================================================================
// Common Workflow
// ============================================================================

export const WORKFLOW = `
<workflow>
1. THINK - Reason about the task
2. ACT - Execute the work
3. OBSERVE - Check the result
4. ADJUST - Fix if needed
5. VERIFY - Prove success with evidence
</workflow>
`;

// ============================================================================
// Base Prompt
// ============================================================================

export const BASE_PROMPT = `
${REASONING_CONSTRAINTS}

${LANGUAGE_RULE}

${ANTI_PATTERNS}

${WORKFLOW}
`;
