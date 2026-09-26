# Agent Memory - OCO Session

Last updated: 2026-09-26 KST

## Current task

Investigate issue #48, which reports that compressed conversation sections reach
the model as user messages. Patch-release the already committed OpenCode 2 agent
registration fix.

## Last completed step

Released `2.0.3` from commit `8d05796` and tag `v2.0.3`. Local release preflight
passed: build, 995 TypeScript tests with coverage, 57 Rust tests, production
dependency audit, dependency tree, and packed-package smoke. TypeScript typecheck
also passed. The GitHub release workflow completed successfully, and npm now
reports `2.0.3` as `latest`.

Issue #48 remains open. Its sole report is a screenshot. The exact marker
`[Compressed conversation section]` is absent from this repository. The upstream
Dynamic Context Pruning implementation creates that marker and inserts its
summary as a synthetic message with `role: "user"`; billion-context documents a
similar user-role carrier. The reporter's installed compression tool and version
are unconfirmed. A small live probe using the model settings in the local
`.bashrc` continued the pending task correctly, so it did not reproduce the
screenshot's confusion.

## Next exact step

Obtain the reporter's OpenCode version, plugin list, compression configuration,
and a minimal reproducible transcript or model request. Confirm which component
adds the compressed user message and reproduce the reported behavior before
changing Orchestrator code or closing #48.

## Incomplete items and why

- Issue #48 is open. The screenshot has no environment details, and the source
  of its compressed messages has not been confirmed for that session.
- No Orchestrator fix for #48 was made. Its existing compaction hook adds mission
  context to the host compaction prompt and does not create the reported marker.
- `.qa-public-package/` remains intact as isolated local QA data. It is excluded
  only through the local `.git/info/exclude` so release checks see a clean tree.

## Key decisions

- Use the existing tag-driven GitHub workflow to publish `2.0.3`, including
  release binaries and the prior OpenCode 2 agent registration fix.
- Keep #48 open until its cause and a fix can be verified in the reported setup.
- Keep the local API token values from `.bashrc` out of logs and repository files.

## Rejected alternatives

- Closing #48 as fixed based on a marker match or a prompt-only mitigation.
- Rewriting third-party summary roles in Orchestrator without knowing plugin
  order, host version, or the provider's message constraints.
- Removing the untracked QA directory merely to satisfy release cleanliness.

## Known risks

- A third-party compression tool may still send summaries under the user role;
  `2.0.3` does not change that transport behavior.
- The minimal local model probe does not reproduce the reporter's environment.

## Files to open first in the next session, in order

1. `AGENTS.md`
2. `AGENT_MEMORY.md`
3. `src/plugin-handlers/session-compacting-handler.ts`
4. `src/v2/setup.ts`
5. `src/agents/commander.ts`
6. `package.json`
7. `README.md`
