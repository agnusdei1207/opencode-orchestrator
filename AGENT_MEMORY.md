# Agent Memory - OCO Session

## Current Task

Complete install/uninstall hardening for multi-plugin OpenCode setups and finish the patch release flow.

## Last Completed Step

Published `opencode-orchestrator@1.2.66`, pushed `v1.2.66`, and synced the README version marker.

## Next Exact Step

Monitor the npm/GitHub release pipeline for `v1.2.66` and verify downstream install paths use the new graceful hook bootstrap.

## Incomplete Items And Why

- No further code changes are pending in this session.

## Key Decisions

- Use `scripts/run-install-hook.mjs` as the lifecycle entrypoint so source checkouts work before `dist/` exists.
- Skip automatic config mutation in CI.
- Prefer `opencode.jsonc` and preserve comments/sibling plugin entries via `jsonc-parser`.
- Install into one resolved config target to avoid duplicate registrations across multiple config roots.
- Uninstall still scans all known config roots so older duplicate registrations can be cleaned safely.

## Rejected Alternatives

- Direct `dist/scripts/*.js` lifecycle hooks without bootstrap fallback.
- Multi-path install writes that register the same plugin in every discovered config directory.
- Plain JSON-only config handling that ignores official `opencode.jsonc` support.

## Known Risks

- Future release runs still depend on Docker availability for native binary packaging.
- Older inline unit tests for install/uninstall logic still exist alongside the new direct process-level scenario tests.

## Open These Files First Next Session

1. `package.json`
2. `scripts/postinstall.ts`
3. `scripts/preuninstall.ts`
4. `scripts/run-install-hook.mjs`
5. `tests/unit/install-hooks.test.ts`
