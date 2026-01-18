/**
 * Verification Requirements
 * 
 * Checklist for verifying code before marking complete.
 */

import { PATHS, PROMPT_TAGS } from "../../../shared/index.js";

export const VERIFICATION_REQUIREMENTS = `${PROMPT_TAGS.VERIFICATION.open}
 VERIFICATION CHECKLIST

## Code Verification
□ lsp_diagnostics clean (no errors/warnings)
□ Build passes (use project's build command from ${PATHS.CONTEXT})
□ Tests pass (use project's test command from ${PATHS.CONTEXT})
□ No untyped variables (language-appropriate)
□ No debug logging left (console.log, print, etc.)

## Documentation Verification
□ Implementation matches ${PATHS.DOCS}/
□ API usage matches official docs
□ Version compatibility confirmed

## Security Verification
□ No hardcoded secrets/passwords/API keys
□ Input validation present
□ Error messages don't leak sensitive info

ONLY mark complete after ALL checks pass!
${PROMPT_TAGS.VERIFICATION.close}`;
