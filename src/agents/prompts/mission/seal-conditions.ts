import { STATUS_LABEL, PATHS, MISSION_SEAL, CHECKLIST } from "../../../shared/index.js";

// Use constant from shared
const CHECKLIST_FILE = CHECKLIST.FILE;

export const SEAL_CONDITIONS = `
## ⚠️ MISSION SEAL VERIFICATION (SYSTEM-ENFORCED)

> **CRITICAL**: The system will VERIFY your SEAL and REJECT it if conditions are not met.
> Premature SEAL = Automatic rejection + forced continuation.

### 📋 VERIFICATION CHECKLIST WORKFLOW

**Step 1: Create Checklist**
Create \`${CHECKLIST_FILE}\` with all verification items for this project:
\`\`\`markdown
# Verification Checklist

## Code Quality
- [ ] **Lint**: No lint errors
- [ ] **Type Check**: Type checking passes

## Unit Tests
- [ ] **Unit Tests**: All unit tests pass

## Build Verification
- [ ] **Build**: Project builds successfully

## Infrastructure (Discover & Add)
- [ ] **[Project-specific]**: [Description]
\`\`\`

**Step 2: Execute Each Check**
- Run the actual verification command
- Observe the result
- Mark [x] only when VERIFIED PASS

**Step 3: Seal When Complete**
- ALL checklist items must be [x]
- ${PATHS.SYNC_ISSUES} must be EMPTY
- Only then output ${MISSION_SEAL.PATTERN}

---

### ✅ SEALED = ALL must be TRUE:
\`\`\`
${STATUS_LABEL.SUCCESS.toUpperCase()} ${CHECKLIST_FILE}: ALL items [x] (or TODO 100% if no checklist)
${STATUS_LABEL.SUCCESS.toUpperCase()} ${PATHS.SYNC_ISSUES}: EMPTY (0 unresolved issues)
────────────────────────────────────────────────
ONLY WHEN ALL ABOVE ARE TRUE → output ${MISSION_SEAL.PATTERN}
\`\`\`

### ❌ SEAL WILL BE REJECTED IF:
\`\`\`
${STATUS_LABEL.FAIL.toUpperCase()} ANY [ ] uncompleted items in checklist
${STATUS_LABEL.FAIL.toUpperCase()} ANY issues listed in ${PATHS.SYNC_ISSUES}
${STATUS_LABEL.FAIL.toUpperCase()} Verification evidence is missing
\`\`\`

### ⚠️ SYSTEM ENFORCEMENT
- The orchestrator performs HARD VERIFICATION on every SEAL attempt
- If checklist exists → ALL items must be [x]
- If no checklist → ALL TODO items must be [x]
- ${PATHS.SYNC_ISSUES} is ALWAYS checked
- Premature SEAL = REJECTED + forced continuation

### BEFORE SEAL - VERIFY
1. \`cat ${CHECKLIST_FILE}\` - ALL [x]
2. \`cat ${PATHS.SYNC_ISSUES}\` - EMPTY
3. ONLY THEN: ${MISSION_SEAL.PATTERN}
`;
