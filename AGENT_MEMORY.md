# Agent Memory - OCO Session

Last updated: 2026-09-24 KST

## Current task

Remove compulsory performance-run wording from the generic refactoring guidance.

## Last completed step

Removed the required before/after measurement checkbox and report field from
`user-prompt/refactor.md`. Scoped its performance and monitoring guidance to
work that explicitly calls for it. Opened `package.json` and
`scripts/release-preflight.mjs` to verify the normal build and release checks.
Re-read the changed document and passed `git diff --check`.

## Next exact step

On the next request, open the restore files below in order, check Git status,
and follow the requested scope.

## Incomplete items and why

None for this documentation change.

## Key decisions

- Keep routine QA focused on build, tests, static checks, and package checks.
- Retain performance guidance only for work that explicitly includes performance.

## Rejected alternatives

- Remove all performance review guidance, including guidance useful for a scoped performance task.

## Known risks

- Later edits to the generic prompt could broaden the scope of its performance checklist again.

## Files to open first in the next session, in order

1. `AGENTS.md`
2. `AGENT_MEMORY.md`
3. `user-prompt/refactor.md`
4. `package.json`
5. `scripts/release-preflight.mjs`
