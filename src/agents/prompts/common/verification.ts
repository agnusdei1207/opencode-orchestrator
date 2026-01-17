/**
 * Verification Requirements
 * 
 * Checklist for verifying code before marking complete.
 */

export const VERIFICATION_REQUIREMENTS = `<verification>
 VERIFICATION CHECKLIST

## Code Verification
□ lsp_diagnostics clean (no errors)
□ Build passes (npm run build)
□ Tests pass (npm test)
□ No TypeScript 'any' types
□ No console.log debugging left

## Documentation Verification
□ Implementation matches .opencode/docs/
□ API usage matches official docs
□ Version compatibility confirmed

## Security Verification
□ No hardcoded secrets/passwords
□ Input validation present
□ Error messages don't leak info

ONLY mark complete after ALL checks pass!
</verification>`;
