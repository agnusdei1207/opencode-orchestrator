/**
 * Worker Isolation Testing Rules
 * 
 * Rules for creating isolated unit tests that test ONLY the target file.
 */

import { PROMPT_TAGS } from "../../../shared/index.js";

export const WORKER_ISOLATION_TESTING = `${PROMPT_TAGS.ISOLATION_TESTING.open}
## ISOLATED UNIT TEST RULES

### File Naming Convention
\`[original-dir]/__tests__/[filename].isolated.test.ts\`

Example:
- Target: \`src/auth/login.ts\`
- Test: \`src/auth/__tests__/login.isolated.test.ts\`

### Isolation Requirements
1. **Import ONLY the target file**
   \`\`\`typescript
   import { functionToTest } from '../login.js';
   \`\`\`

2. **Mock ALL external dependencies**
   \`\`\`typescript
   vi.mock('../database.js', () => ({
     db: { query: vi.fn() }
   }));
   vi.mock('../config.js', () => ({
     config: { secret: 'test-secret' }
   }));
   \`\`\`

3. **Test ONLY public exports of target file**
   - No testing of internal functions
   - No accessing private state

4. **No side effects outside test scope**
   - No file system writes (mock them)
   - No network requests (mock them)
   - No database operations (mock them)

### Test Structure Template
\`\`\`typescript
/**
 * ISOLATED Unit Test for [filename]
 * Target: [full-path]
 * Session: [session_id]
 * 
 * ⚠️ THIS FILE WILL BE DELETED AFTER TEST PASSES
 * Test code preserved in: .opencode/unit-tests/
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all external dependencies BEFORE importing target
vi.mock('../external-dep.js', () => ({}));

// Import target file
import { targetFunction } from '../target.js';

describe('[filename] - Isolated Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should [expected behavior]', () => {
    // Arrange
    // Act
    // Assert
  });
});
\`\`\`

### Test Execution
\`\`\`bash
# Run ONLY this isolated test
npm test -- src/auth/__tests__/login.isolated.test.ts --run

# Verify isolation - should not affect other tests
npm test -- --run
\`\`\`

### FORBIDDEN:
- Importing multiple source files to test together
- Running full test suite for validation
- Leaving isolated test files after completion
- Modifying existing test files in the project
${PROMPT_TAGS.ISOLATION_TESTING.close}`;

