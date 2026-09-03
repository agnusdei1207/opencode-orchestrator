# ADR-0014: Bundled jsonc-parser Relative-Import Fix

Date: 2026-07-02 18:45 KST
Status: Implemented
Source: `docs/histories/2026/07/02/PLAN_FixBundledJsoncParserRelativeImports_2026-07-02.md` (removed 2026-09-03; history in git)

## Context

The plugin failed to load wherever the bundled `jsonc-parser` copy resolved
its relative imports differently across environments — a packaging defect, not
a consumer error.

## Decision

- Fix with `packages: external` (the correct fix, not just the reported
  symptom): keep the dependency external to the bundle so Node resolves it
  normally in every environment.

## Consequences

- Verified over 5 rounds across environments.
- Follow-up audit in ADR-0015 added the regression guard this fix lacked.
