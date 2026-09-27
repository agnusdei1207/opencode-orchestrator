# Agent Memory - OCO Session

Last updated: 2026-09-27 23:51 KST

## Current task

Issue #48: a compressed conversation section appears to the model as a user
message. A Commander prompt mitigation was committed and released as `v2.0.8`.
The issue remains open until the reporter's environment and model behavior can
be checked.

## Last completed step

Read the issue and screenshot, OCO compaction and prompt paths, and OpenCode
1.18.32's compaction source. The screenshot's exact `[Compressed conversation
section]` marker is defined by OpenCode Dynamic Context Pruning (DCP). Its
`filterCompressedRanges` calls `createSyntheticUserMessage`, which sets
`info.role` to `user`. The reporter's DCP installation is unconfirmed because
the issue provides no plugin list, version, or serialized session messages.
OCO itself has no producer of that marker; its compaction hook contributes
host context, and its own continuation prompts are marked synthetic.

Commit `1d92b96` adds a Commander instruction to interpret marked compressed
sections as historical context while honoring actual user requests. The same
definition reaches OpenCode 1 through generated agent config and OpenCode 2
through the agent transform. Tests cover both registration paths and the
snapshot. Architecture documentation describes the boundary. The role on the
wire is still owned by the producing plugin or host; OCO does not rewrite
another plugin's messages. A user-supplied same-name V1 Commander prompt can
override the default instruction.

`npm run release:patch` created `ad2128c` and `v2.0.8` and atomically pushed
main and tag. Local release preflight passed build, 119 TypeScript files /
1,034 tests and coverage gate, 57 Rust tests and quality checks, production
npm audit, dependency check, and packed-package smoke. Built v2.0.8 passed
all 16 isolated OpenCode 1.18.32 live-host checks, including compressed-only
and compressed-then-real-user provider payloads. This QA verifies prompt and
message delivery, not the behavior of the reporter's MiMo model or DCP plugin.
Hosted release run `36327070709` succeeded. The GitHub release contains all
five platform binaries. CI logged `+ opencode-orchestrator@2.0.8` and a fresh
npm cache confirmed version `2.0.8` and `latest: 2.0.8` after registry
processing completed.

## Next exact step

Obtain the reporter's OpenCode version, plugin list, and messages immediately
around the compressed block. Reproduce with DCP if installed and assess
whether its producer-side role should change. Verify the v2.0.8 model-level
behavior with the reporter's MiMo setup before closing #48.

## Incomplete items and why

- #48 stays open: reporter configuration and model-level reproduction are
  missing. The shipped change mitigates interpretation, not the DCP user role.
- No released OpenCode 2 executable was installed for live QA. V2 prompt
  registration is covered by the installed plugin contract and tests.

## Key decisions

- Add the interpretation rule to the shared Commander definition so both
  OpenCode generations receive it.
- Preserve a real request accompanying or following a compressed section.
- Keep #48 open until real reporter confirmation.

## Rejected alternatives

- Rewrite DCP's user-role message from OCO: plugin ordering and message schema
  make this unsafe without reporter evidence or a stable shared contract.
- Attribute the reporter's plugin inventory from the screenshot alone.

## Known risks

- A model can still ignore the prompt rule; the actual user-role payload is
  unchanged. The reporter's MiMo model was not available for QA.
- User-overridden V1 Commander prompts do not inherit this default rule.
- OCO and DCP hook ordering in the reporter's setup is unknown.

## Files to open first in the next session, in order

1. `AGENTS.md`
2. `AGENT_MEMORY.md`
3. `src/agents/commander.ts`
4. `src/agents/definitions.ts`
5. `src/plugin-handlers/config-handler.ts`
6. `src/v2/agent-adapter.ts`
7. `scripts/qa-native-host.mjs`
8. `docs/SYSTEM_ARCHITECTURE.md`
