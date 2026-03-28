# Agent Memory - OCO Session

## Current Task

Monitor the published `opencode-orchestrator@1.2.68` release and confirm downstream global installs and explicit cleanup usage behave as documented.

## Last Completed Step

Fixed Node 24 install-hook packaging, documented explicit global cleanup, verified tarball install plus `npm explore -g ... -- npm run cleanup:plugin`, and published `opencode-orchestrator@1.2.68`.

## Next Exact Step

From a clean machine or shell, run `npm install -g opencode-orchestrator@1.2.68` and confirm the published postinstall registers the plugin without the former dynamic-require failure.

## Incomplete Items And Why

- Automatic cleanup on `npm uninstall -g` is still not possible because npm 11 does not invoke dependency uninstall hooks in the validated global flow.

## Key Decisions

- Keep the lifecycle bootstrap approach so installs still work before `dist/` exists.
- Force esbuild hook bundles to prefer `module` over `main` so `jsonc-parser` resolves to its ESM entry under Node 24.
- Keep the uninstall logic as an explicit `cleanup:plugin` command and document it instead of pretending `preuninstall` runs automatically in global npm flows.
- Revert the temporary local OpenCode config mutation caused during diagnosis after verification finished.

## Rejected Alternatives

- Leaving hook bundling on the default esbuild entry resolution and accepting the Node 24 dynamic-require crash.
- Continuing to advertise automatic uninstall cleanup when observed npm behavior and local npm docs show that dependency uninstall hooks are not run in this flow.
- Externalizing `jsonc-parser` from the hook bundle, which broke temp-file execution during validation.

## Known Risks

- Release packaging still depends on Docker being available for the Rust binary build.
- The older helper-level `postinstall`/`preuninstall` unit tests still duplicate some script behavior and may drift if the scripts evolve further.

## Open These Files First Next Session

1. `AGENT_MEMORY.md`
2. `package.json`
3. `README.md`
4. `tests/unit/install-hooks.test.ts`
5. `scripts/postinstall.ts`
