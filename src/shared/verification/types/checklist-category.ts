/**
 * Checklist Category Type
 * 
 * Type definition for verification checklist categories.
 * Derived from CATEGORY_ID constant for single source of truth.
 */

/**
 * Available checklist category identifiers
 * 
 * - code-quality: Lint, type check, static analysis
 * - unit-tests: Unit tests execution
 * - integration-tests: E2E and integration tests
 * - build: Build verification
 * - runtime: Runtime verification (starts, runs)
 * - infrastructure: Docker, compose, CI/CD, etc.
 * - custom: Project-specific custom checks
 */
export type ChecklistCategory =
    | "code-quality"
    | "unit-tests"
    | "integration-tests"
    | "build"
    | "runtime"
    | "infrastructure"
    | "custom";
