# Agent Memory - OCO Session

## Current Task

Harden plugin install/uninstall so source checkouts, CI, JSONC configs, and multi-plugin setups behave gracefully without config collisions.

## Last Completed Step

Implemented install-hook bootstrap fallback, CI no-op behavior, JSONC-aware config patching, single-target install semantics, and direct scenario tests covering real install/uninstall entrypoints.

## Next Exact Step

Commit the install-hook hardening changes, push the fix commit, then run `npm run release:patch` followed by `git push --follow-tags`.

## Incomplete Items And Why

- Release publish has not run yet in this snapshot because it has external side effects: version bump, Docker native packaging, npm publish, and remote push.

## Key Decisions

- Use `scripts/run-install-hook.mjs` as the stable lifecycle entrypoint so install hooks work before `dist/` exists.
- Skip automatic config mutation in CI because runner environments should not touch user config.
- Prefer `opencode.jsonc` over `opencode.json` and preserve comments via `jsonc-parser`, matching OpenCode’s documented config behavior.
- Install into a single resolved config target instead of mutating every discovered config path, while uninstall still cleans every known location to remove duplicates safely.
- Keep sibling plugin entries untouched and only match our own plugin by exact name or version-suffixed self entry.

## Rejected Alternatives

- Continue calling `dist/scripts/*.js` directly from npm lifecycle scripts: rejected because source checkout installs fail before build.
- Write to every discovered config path during install: rejected because it creates duplicate registrations when multiple config roots exist.
- Skip `.jsonc` support and only handle plain JSON: rejected because OpenCode officially supports and prefers `opencode.jsonc`.

## Known Risks

- Release still depends on Docker availability for native binary packaging and valid npm publish credentials.
- Existing older tests for install/uninstall logic still include inline mirrors of legacy behavior; the new direct process tests now cover the real entrypoints.

## Open These Files First Next Session

1. `package.json`
2. `scripts/postinstall.ts`
3. `scripts/preuninstall.ts`
4. `scripts/run-install-hook.mjs`
5. `tests/unit/install-hooks.test.ts`
