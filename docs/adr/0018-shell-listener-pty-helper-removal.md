# ADR-0018: Shell-Listener One-Touch PTY Helper Removal

Date: 2026-09-03 23:22 KST
Status: Implemented
Source: git commit 8248ce0 (2026-09-03 22:31, "fix: remove one-touch pty helper
from shell-listener TUI"); defect-driven decision, no plan file.

## Context

The shell-listener TUI offered a one-touch `pty` command that sent a hardcoded
`python3 pty.spawn` one-liner to the active session. Three problems: `send`
already covers the same operator action, the one-liner assumes `python3` and
`/bin/sh` (broken on Windows lab hosts), and it widened the remote-shell attack
surface of an authorized-lab tool.

## Decision

- Remove the `pty` operator command from the TUI command set.
- Interactive input stays on `send <text>`; completion detection stays on
  `run <cmd>` with sentinel markers. No replacement upgrade mechanism is added.
- The listener remains a raw TCP session manager; it does not spawn PTYs.

## Consequences

- Smaller command surface, no Windows-breaking interpreter assumption, and a
  reduced remote-shell attack surface.
- Removal covered by the existing `shell_listener` suite (12 pass at commit
  time, clippy clean per the commit). Full gates re-measured 2026-09-03:
  vitest 1063/1063 pass, docker `cargo test` exit 0.
- `docs/SYSTEM_ARCHITECTURE.md` section 7 re-aligned with the code in the same
  change (the "manual PTY helper" step was removed).
- Release binaries in `bin/` built before this change (macOS x64/arm64,
  Windows x64, and the extensionless `orchestrator` fallback) still contained
  the removed command. Owner decision 2026-09-03: those four stale binaries
  were removed from the repository; `bin/` now tracks only the Linux pair the
  release pipeline refreshes. npm releases are unaffected because CI rebuilds
  all five targets from the tag source before publishing. Non-npm consumers of
  a repo checkout on macOS/Windows rebuild locally via
  `docker:rust-dist`/`docker:build-win` (the `binary.ts` extensionless
  fallback path no longer resolves from the repo tree).
