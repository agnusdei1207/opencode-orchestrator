# Agent Memory - OCO Session

Last updated: 2026-09-28 KST

## Current task

Issue #50's standalone `</assistant-thinking></think>` artifact has a
stored-text mitigation for OpenCode 1 in patch release v2.0.9. Static flow
analysis found that append-only streaming clients can retain already emitted
text. The reporter's OpenCode Go / MiMo-V2.6-Flash setup still needs
confirmation before closing the issue.

## Last completed step

Read issue #50 and screenshot, the local `../opencode` host source, the OCO
V1/V2 plugin paths, and the SDK contracts. The local OpenCode source identifies
as 1.18.32. OCO declares and locks `@opencode-ai/plugin` and
`@opencode-ai/sdk` 1.18.32 plus OpenCode 2 `@opencode/plugin` 2.0.15. Local
node_modules had stale 1.18.31 V1 packages; `npm ci --ignore-scripts` restored
the declared versions. The installed host executable is OpenCode 1.18.31.

In OpenCode 1's `session/processor.ts`, text deltas are streamed to session
parts, then `experimental.text.complete` can replace text before the final
part update. No equivalent text completion hook exists in the inspected
OpenCode 2 plugin contract. OCO's V1 entry now registers
`createTextCompleteHandler`, which blanks a completed text part only when its
trimmed content is exactly the reported closing-tag pair. Other text remains
unchanged. The shared hook constant, handler barrel, entry-point test, native
host QA fixture, and architecture document are synchronized.

TDD: the entry test failed before hook registration and passed afterward. A
second red/green cycle narrowed the behavior to an entire standalone text
part. `npm run build`, `npx tsc --noEmit`, and all 119 Vitest files / 1,035
tests passed. Rust fmt/clippy, all 57 Rust tests, production dependency audit,
and package smoke test passed. Built-plugin QA against installed OpenCode
1.18.31 passed all 17 checks, including a streamed fixture with the exact
reported tag and a persisted assistant text part that was empty after the
completion hook. Both local release dry run and v2.0.9 preflight passed.
`git diff --check` passed. The sibling `../opencode` repository was read only.
A read-only code review found no critical defect; its QA and documentation
findings were addressed.

Implementation commit `44fa6d5` and version commit `cfc1c24` were pushed
to `origin/main` with tag `v2.0.9`. GitHub CI run 36363989484 and Build &
Release run 36363989401 succeeded. The GitHub Release has five platform
binaries. The public npm registry reports `opencode-orchestrator@2.0.9` and
`latest: 2.0.9`; its tarball metadata is present.

Post-release static flow analysis traced model text/reasoning events through
the host processor, shared plugin trigger, final part update, model-history
conversion, compaction, OpenCode `run`, ACP, and app state reducers. The host
publishes text deltas before the completion hook. The `run` renderer and ACP
can retain those deltas even when the final stored part is blank. Host cleanup
also bypasses the hook if a stream ends before `text-end`. Other plugins can
mutate the same output in load order. No direct OCO-internal hook collision
was found; the reporter's other plugins are unknown.

## Next exact step

Have the reporter test v2.0.9 with their OpenCode Go / MiMo setup. Record
their OpenCode version, plugin list, client surface, and serialized assistant
part type. If the tag remains visible, compare stored parts with streamed
deltas and investigate an upstream OpenCode provider/client fix. Do not close
#50 before this confirmation.

## Incomplete items and why

- #50 actual MiMo model behavior and reporter's OpenCode version are unknown.
  The fixture proves the V1 hook path for the reported text shape.
- OpenCode 2 has no corresponding text-completion hook in its inspected
  `@opencode/plugin` 2.0.15 contract; this OCO mitigation is V1 only.
- Append-only clients can retain already emitted tag deltas; the finalized
  text hook cannot retract them. Actual reporter client behavior is unknown.
- #48 remains open from the prior session pending the reporter's DCP/plugin
  configuration and model-level behavior after v2.0.8.

## Key decisions

- Use the OpenCode 1 text completion hook, which runs before the final part
  update, for the narrow standalone artifact shown in #50.
- Preserve text that merely contains the same tag or includes legitimate
  surrounding content.
- Leave the sibling OpenCode repository unchanged; its response pipeline and
  SDK contract were used as evidence for the OCO fix.
- Keep the existing unrelated `ARCHITECTURE_SURVEY_KO.tmp.md` untouched. It
  was temporarily excluded for the clean release gate; the local exclude
  file was restored afterward.

## Rejected alternatives

- Strip all `<think>` markup or every occurrence of the tag pair: this could
  alter code examples and ordinary assistant output.
- Rewrite reasoning parts through event callbacks: the event path is after
  host storage and provides no safe V1 response mutation contract.
- Change only the TUI display: stored session text and follow-up context
  would still contain the artifact.

## Known risks

- OpenCode `run` and ACP can retain streamed tag text after the final part is
  blanked; other clients may show it transiently until the final update.
- An interrupted stream can bypass `experimental.text.complete` and store
  unfinished tag text. Another plugin can modify the shared hook output
  before or after OCO depending on load order.
- If the reporter's tag is in a reasoning part, this text-only hook cannot
  affect it. The screenshot suggests a text line but has no serialized parts.
- The implementation has no OpenCode 2 equivalent at this SDK version.

## Files to open first in the next session, in order

1. `AGENTS.md`
2. `AGENT_MEMORY.md`
3. `src/plugin-handlers/text-complete-handler.ts`
4. `src/index.ts`
5. `src/shared/message/constants.ts`
6. `tests/unit/plugin-entry.test.ts`
7. `scripts/qa-native-host.mjs`
8. `docs/SYSTEM_ARCHITECTURE.md`
9. `../opencode/packages/opencode/src/session/processor.ts`
