import { STATUS_LABEL, PATHS, MISSION_SEAL, PROMPT_TAGS } from "../../../shared/index.js";

export const SEAL_CONDITIONS = `
## SEALED CONDITIONS (CRITICAL!)

### SEALED = ALL must be true:
\`\`\`
${STATUS_LABEL.SUCCESS.toUpperCase()} ${PATHS.TODO}:        ALL items [x] (100%)
${STATUS_LABEL.SUCCESS.toUpperCase()} ${PATHS.SYNC_ISSUES}: EMPTY (0 issues)
${STATUS_LABEL.SUCCESS.toUpperCase()} Build/Execution:  ${STATUS_LABEL.PASS.toUpperCase()} (unambiguous evidence present)
───────────────────────────────────
ONLY THEN → output ${MISSION_SEAL.PATTERN}
\`\`\`

### LOOP BACK = ANY of these:
\`\`\`
${STATUS_LABEL.FAIL.toUpperCase()} ${PATHS.TODO} < 100% → LOOP
${STATUS_LABEL.FAIL.toUpperCase()} ${PATHS.SYNC_ISSUES} > 0 → LOOP
${STATUS_LABEL.FAIL.toUpperCase()} Execution Evidence is missing or suspicious → LOOP
${STATUS_LABEL.FAIL.toUpperCase()} Agent timeout/stuck → DECOMPOSE per ${PROMPT_TAGS.RECOVERY.open} and LOOP
\`\`\`
`;
