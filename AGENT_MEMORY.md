# Agent Memory - OCO Session

Last updated: 2026-10-26 KST

## Current task

A full refactoring audit, done as a behavior-preserving cleanup, is committed,
pushed and released as npm/GitHub 2.0.17. The user authorized commit, push and
the patch release. The methodology reference was
https://github.com/agnusdei1207/dev-skill (build-software skill), read from a
scratch clone. Starting main was clean at d049cd2 (2.0.16).

## Last completed step

- Baseline: build passed, 128 files / 1,153 tests.
- Audit tools were throwaway probes, never added to the repo: knip in
  production mode (entries src/index.ts and src/cli.ts, tests excluded), an
  ESLint probe enforcing the AGENTS.md limits, and a constant-key scan.
  The ESLint probe found 0 violations in src before and after.
- c195649 removes test-only and write-only runtime code: core/progress,
  shared/errors/retry, utils/parsing/safe-json, getContextInjection, toast
  history/dismiss/getHistory/clear and the handler list,
  ConcurrencyController.getConfig, ShutdownManager.isShutdown, Todo types,
  and orphaned constants (HISTORY, two LIMITS keys, MAX_RETRY_MULTIPLIER).
- 944988f removes the circuit breaker's tool-repetition path. It has been
  unreachable since d10b179; only tripOutputCircuit opens the circuit, with a
  single 10-minute reset. A new regression test pins that tool-calling turns
  never open it.
- 5e9b417 removes scripts/tail-log.mjs and `npm run log`, since nothing writes
  the log. log() stays as a documented no-op seam (TUI corruption, 4b7f360).
- dab1efa translates ADR-0020's Korean quote and fixes a mojibake `×` in a test.
- 0860d49 (Rust) drops the unread ast-grep range.end field. Docker fmt,
  Clippy with -D warnings, and 46 + 112 tests pass.
- 3beae63 and 14d51de add ADR-0026 and its index entry.
- After the work: 125 files / 1,113 tests pass. Coverage is statements
  91.56%, branches 82.71%, functions 93.93%, lines 93.76%. TS source went from
  198 files / 17,367 lines to 192 / 16,730.
- Release: the first preflight failed `npm ls` because local node_modules had
  zod 4.6.5 against a lockfile pin of 4.6.7 (stale install). `npm ci` fixed it.
  The second preflight passed and atomically pushed main + v2.0.17 (749dc3a).
- Hosted CI 40305724448 and Build & Release 40305724044 succeeded: all five
  platform builds, artifact verification, npm publish and GitHub Release.
  npm metadata lagged about 3 minutes, then latest became 2.0.17,
  shasum 65da6a91da3e89da54e6c764b54312994f835397.
- A fresh consumer install of 2.0.17 imports with the same default export
  keys as 2.0.16 (id, server, setup) and no longer contains scripts/.

## Next exact step

None for this task. If the user approves, fix the three ADR-0026 defects as
separate behavior changes, one change each, with RED to GREEN tests.

## Incomplete items and why

- These are behavior changes, so they were deliberately left out of the
  refactor (recorded in ADR-0026):
  1. show_metrics prints agent latency, success rate and sub-tasks, which
     production never records, so they read empty or 0.
  2. session.deleted does not clear core/loop/progress-tracker state; the
     10-minute prune releases it.
  3. SanityCheckHook.clearSession is never wired; one cooldown timestamp
     per session is kept for the process lifetime.
- The landing page's Korean SEO keywords (index.html, public/index.html) were
  kept on purpose as product content, not code or docs. Ask the user if
  English-only should apply there too.
- user-prompt/ (English prompt templates, unreferenced by code) was kept as
  user-curated material.
- src/utils and src/v2 folder names were not restructured. A large pure-move
  refactor needs its own intent, and v2 is the OpenCode 2 host API term.
- The GITHUB_TOKEN in ~/.bashrc is rejected by GitHub and gh has no stored
  login. git push works through the credential manager, and the hosted
  workflows were verified through the public API. The user should refresh
  the token.
- The actual OpenCode native-host QA script was not rerun for 2.0.17. The
  repository suite, including the native-host contract tests, passed.

## Key decisions

- Single writer, no subagents. Every removal is behavior-preserving.
- Test seams (reset*/get*State/_resetForTesting/getMonitorStatus) are kept.
- One concern per commit, so any one can be reverted on its own.

## Rejected alternatives

- Removing all 160 no-op log() call sites: a large diff with no behavior gain.
- Wiring or removing the unread metrics fields inside the refactor: that
  changes tool output.
- Bumping again after the failed preflight. The local v2.0.17 tag was
  unpublished, so preflight and push were rerun instead.

## Known risks

- Consumers still inherit upstream transitive advisories from the V1 plugin's
  pins; see CONTRIBUTING.
- Developers with an old node_modules must run `npm ci` before release
  preflight.

## Files to open first in the next session, in order

1. AGENTS.md
2. AGENT_MEMORY.md
3. docs/adr/0026-remove-test-only-runtime-code.md
4. src/core/metrics/collector.ts
5. src/tools/parallel/show-metrics.ts
6. src/plugin-handlers/event-handler.ts
7. src/hooks/features/sanity-check.ts
8. src/core/loop/progress-tracker.ts
9. src/core/loop/circuit-breaker.ts
