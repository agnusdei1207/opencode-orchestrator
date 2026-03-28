# Agent Memory - OCO Session

## Current Task

Verify README rendering, harden multi-plugin install/uninstall behavior, and complete the patch release flow.

## Last Completed Step

Published `opencode-orchestrator@1.2.67`, updated README wording/rendering, and added uninstall regression coverage for no-op and multi-config-root cleanup.

## Next Exact Step

Monitor the npm/GitHub pipeline for `v1.2.67` and confirm downstream installs pick up the quieter uninstall cleanup behavior.

## Incomplete Items And Why

- No further code changes are pending in this session.

## Key Decisions

- Keep the lifecycle bootstrap approach so installs still work before `dist/` exists.
- Delay uninstall backup creation until an actual plugin removal is about to happen.
- Keep `.jsonc` as the preferred config format and preserve sibling plugin entries/comments.
- Clean up README wording so the test utility section reads like this project, not borrowed marketing copy.

## Rejected Alternatives

- Creating uninstall backups even when no config mutation happens.
- Leaving the garbled README heading and “Test Harness System” wording in place.
- Pushing the release tag before README and session memory were brought back into sync.

## Known Risks

- Release packaging still depends on Docker being available for the Rust binary build.
- The older helper-level `postinstall`/`preuninstall` unit tests still duplicate some script behavior and may drift if the scripts evolve further.

## Open These Files First Next Session

1. `AGENT_MEMORY.md`
2. `package.json`
3. `README.md`
4. `scripts/preuninstall.ts`
5. `tests/unit/install-hooks.test.ts`
