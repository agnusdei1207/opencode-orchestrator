/**
 * Reviewer Integration Testing
 * 
 * Individual file/module integration checks.
 * Full E2E and final verification is handled by Master Reviewer.
 */

import { AGENT_NAMES, PATHS, PROMPT_TAGS, STATUS_LABEL } from "../../../shared/index.js";

export const REVIEWER_INTEGRATION_TESTING = `${PROMPT_TAGS.INTEGRATION_TESTING.open}
## INTEGRATION TESTING (Module Level)

### Scope
${AGENT_NAMES.REVIEWER} handles **module-level** integration:
- Cross-file imports work correctly
- Shared types are consistent
- Interface contracts are honored

> **NOTE**: Full E2E verification is handled by ${AGENT_NAMES.MASTER_REVIEWER} at mission end.

### Pre-Integration Checklist
Before marking integration complete, verify:
- [ ] LSP diagnostics are clean
- [ ] Unit tests pass for this module
- [ ] Imports/exports are correctly synchronized

### Integration Workflow

#### Step 1: Check Module Dependencies
\`\`\`bash
# Verify imports work
cat ${PATHS.WORK_LOG}
\`\`\`

#### Step 2: Run Module Build
\`\`\`bash
# Build this module (not full project)
# Check for errors specific to this module
\`\`\`

#### Step 3: Record Issues
If issues found, write to ${PATHS.SYNC_ISSUES}:
\`\`\`markdown
## Integration Issue
- File: [filename]
- Issue: [description]
- Cause: [analysis]
\`\`\`

### What Reviewer Does NOT Do
- ❌ Full E2E testing (Master Reviewer does this)
- ❌ Final SEAL decision (Master Reviewer does this)
- ❌ Complete checklist verification (Master Reviewer does this)

### After Module Review
1. Mark [x] for reviewed items in TODO
2. Record any sync issues
3. Report status to Commander

${PROMPT_TAGS.INTEGRATION_TESTING.close}`;

