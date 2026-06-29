# PTY Session Control Adoption Plan

Date: 2026-06-29

## Scope

This plan compares `../pentesting` with the current `opencode-orchestrator`
PTY/session surface and lists only items worth adopting into this system.

The goal is not to import pentesting-domain behavior. The useful parts are the
runtime session-management patterns around long-running terminals: lifecycle
state, deterministic cleanup, bounded resource use, structured observation, and
operator-controlled PTY/pipe sessions.

## Current State

`opencode-orchestrator` already has a deliberately separated authorized lab
listener at `crates/orchestrator-cli/src/shell_listener.rs`.

Useful existing properties:

- The listener is CLI-only and not registered as a model-callable plugin tool.
- It binds to `127.0.0.1` by default and requires `--allow-remote` for non-loopback binds.
- It keeps raw logs under `.opencode-orchestrator/shell-listener/`.
- It has simple operator commands: `sessions`, `use`, `send`, `run`, `pty`, `close`, `quit`.

Weak points:

- Session state is only `open/closed` plus an active id. There is no explicit
  `open -> idle/busy/stale -> closing -> closed -> archived` lifecycle.
- `run <cmd>` sends a sentinel but does not track a pending run, timeout,
  output cursor, marker match, or structured completion result.
- Closing a session only shuts down the writer-side `TcpStream`; there is no
  runtime-held close handle/revoke path that guarantees blocked readers and fds
  are reclaimed.
- There is no fd budget/admission control, so many connections can exhaust the
  process fd limit before the operator has a chance to recover.
- Preview sanitization strips simple escape sequences but has no sensitive-value
  redaction list and no prompt classification.
- The current Rust subprocess helper is strong for one-shot commands
  (`run_with_timeout`) but intentionally not a stateful PTY/session manager.

## What To Adopt

### 1. Explicit Session Lifecycle

Adopt a typed `SessionState` model inspired by `../pentesting`:

- `SessionBackend`: `tcp`, later `local_pty`, later `pipe`.
- `SessionStatus`: `open`, `idle`, `busy`, `stale`, `closing`, `closed`, `archived`.
- Lifecycle timestamps: `connected_at`, `last_seen`, `closing_at`, `closed_at`, `archived_at`.
- Session metadata: `bytes`, `raw_log_path`, `last_sentinel`, `last_prompt`, `exit_status`.
- Output cursor support so tools/operators can read from a known line offset.

Why adopt: this gives the operator and tests a real state machine instead of
inferring behavior from booleans and buffered text.

### 2. Deterministic Close And Revoke

Adopt a runtime-owned close control:

- For TCP sessions, keep a close handle that can force `shutdown(Shutdown::Both)`.
- Add a shared revoked flag observed by reader/writer loops.
- Make `close` graceful and `revoke` hard-close.
- Preserve the invariant: `closed` means runtime-held session fds have been released.

Why adopt: current close behavior is cooperative. A blocked reader or half-open
connection can linger and hold resources.

### 3. FD Budget And Admission Control

Adopt `RLIMIT_NOFILE`-based accounting:

- Measure soft fd limit on Unix.
- Reserve fixed headroom for stdio, logs, control socket, and subprocesses.
- Estimate fds per session.
- Reject new sessions once `active_sessions >= max_sessions`.
- Add operator-visible `fdstat` output and pressure warnings.

Why adopt: this is the most practical hardening for a listener that can accept
multiple sessions.

### 4. Structured Run/Observe Protocol

Adopt pending-run tracking before adding any broader control plane:

- `run` creates a unique marker and records start cursor, timeout, and deadline.
- Completion is marker-based and returns output since the start cursor, excluding the marker line.
- `observe`/`tail` read bounded output by cursor and byte limit.
- `expect` waits for literal/regex output with a timeout.

Why adopt: the existing sentinel command is useful but not machine-checkable.
This turns it into reliable operation evidence.

### 5. Local Control Socket, Operator First

Adopt a local Unix control socket only for CLI/operator commands:

- Add `orchestrator shell-session ...` as a CLI client for `list`, `info`, `tail`,
  `send`, `run`, `close`, `revoke`, `fdstat`, and `lifecycle`.
- Keep it outside `src/tools/registry.ts` and outside model-callable JSON-RPC.
- Make every control request JSONL, versioned, and auditable.

Why adopt: it enables scripts and tests to drive the listener without turning
PTY control into a general LLM tool.

### 6. Local PTY/Pipe Sessions, Behind Explicit Operator Command

Adopt local `spawn` only after the lifecycle/control foundation is in place:

- `mode=pty` for interactive terminal-backed processes.
- `mode=pipe` for stdin/stdout/stderr pipe processes.
- Support `resize` and `signal` for local PTY/pipe backends.
- Gate this behind the explicit listener/control socket path, not plugin tool calls.

Why adopt: it covers real interactive workflows and testability, but it has the
largest security and cross-platform footprint.

### 7. Prompt Detection And Redaction

Adopt conservative prompt tagging:

- Detect password, yes/no, login, 2FA, pager, and generic prompts.
- Detection must be read-only metadata; it must not auto-answer.
- Add a per-session redaction list for values injected by controlled secret paths.
- Redact display output and raw-log writes where the secret is known.

Why adopt: prompt metadata helps operators decide what input is needed, while
redaction prevents avoidable leakage in logs and summaries.

### 8. Test Harness

Adopt focused tests from the `pentesting` approach:

- Unit tests for lifecycle transitions, cursor math, redaction, fd budget, and pending runs.
- Integration tests for control socket request/response shape.
- Opt-in live PTY smoke tests on Unix for boot, resize, signal, prompt detection, and cleanup.
- A stress-style test that proves closed/revoked sessions release fd ownership.

Why adopt: PTY bugs are often lifecycle/resource bugs, not parser bugs.

## What Not To Adopt

- Do not adopt pentesting-specific skills, exploit helpers, payload recipes, or
  offensive workflow defaults.
- Do not register `session_control` or `process` as model-callable tools in the
  first implementation.
- Do not let the model spawn local PTYs directly.
- Do not add remote bind convenience shortcuts. Keep loopback default and
  explicit `--allow-remote`.
- Do not add fd passing or cross-process fd ownership until there is a concrete
  need; the listener should remain the sole owner of session fds.

## Implementation Plan

### Phase 0: Boundary Lock

1. Document invariants in `docs/SYSTEM_ARCHITECTURE.md`.
2. Add a regression test that fails if shell/session-control commands appear in
   the plugin tool registry.
3. Confirm the listener remains operator-driven and CLI-only.

Acceptance criteria:

- No OpenCode JSON-RPC tool can spawn, send to, or control a PTY session.
- `orchestrator shell-listener --help` remains the explicit entry point.

### Phase 1: Split Listener Modules

1. Split `crates/orchestrator-cli/src/shell_listener.rs` into modules:
   `accept`, `reader`, `writer`, `session`, `terminal`, `pending`, `fd_budget`,
   `runtime`, and `control`.
2. Move current parsing/TUI behavior without changing user-visible commands.
3. Introduce `SessionState`, `SessionBackend`, `SessionStatus`, and cursor-based output helpers.

Acceptance criteria:

- Existing shell-listener tests still pass.
- No behavior change for `sessions`, `use`, `send`, `run`, `pty`, `close`, `quit`.

### Phase 2: Lifecycle And Cleanup

1. Add `closing`, `closed`, and `archived` transitions.
2. Add runtime-held TCP close control and `revoke`.
3. Ensure closed sessions drop close handles and writer resources.
4. Add raw-log archive/prune behavior for closed sessions.

Acceptance criteria:

- Closing a session prevents further writes.
- Revoking a session unblocks reader/writer loops.
- Tests prove `closed` sessions no longer own runtime close handles.

### Phase 3: Resource Budget

1. Add fd budget calculation and active-session guards.
2. Reject new sessions when fd budget is exhausted.
3. Emit pressure warnings at a fixed threshold.
4. Add `fdstat` to the operator/control surface.

Acceptance criteria:

- Unit tests cover low fd limits, saturation, warning threshold, and guard drop.
- Listener remains responsive under connection pressure.

### Phase 4: Structured Control Socket

1. Add a Unix JSONL control socket under `.opencode-orchestrator/shell-listener/control.sock`.
2. Add `orchestrator shell-session` commands for read-only operations first:
   `health`, `list`, `info`, `tail`, `lifecycle`, `fdstat`.
3. Add write operations second: `send`, `raw`, `run`, `close`, `revoke`.
4. Write an audit JSONL record for every control request.

Acceptance criteria:

- Control requests are versioned and return structured JSON.
- Read-only commands cannot mutate session state.
- Write commands refuse closed/archived sessions.

### Phase 5: Pending Run/Expect

1. Replace the current fire-and-forget sentinel with `PendingRun`.
2. Add output cursor capture before sending the command.
3. Complete pending runs on marker match or timeout.
4. Add `expect` with bounded output and timeout.

Acceptance criteria:

- `run` returns marker, timed_out, output, next_cursor, and session summary.
- Marker lines are excluded from returned command output.
- Timed-out runs return partial output without losing session state.

### Phase 6: Prompt Detection And Redaction

1. Add conservative prompt detection to recent display output.
2. Store `last_prompt` on each session.
3. Add session redaction lists and apply them to preview/raw-log write paths where possible.
4. Add documentation that prompt detection never authorizes automatic input.

Acceptance criteria:

- Password/yes-no/login/2FA/pager prompts are detected in unit tests.
- Known sensitive values are redacted from display output.
- No code path auto-answers prompts from detection alone.

### Phase 7: Local PTY/Pipe Spawn

1. Add Unix-only local PTY backend.
2. Add pipe backend for non-interactive long-running processes.
3. Support `resize` and `signal`.
4. Keep local spawn behind `orchestrator shell-session spawn` and explicit listener startup.

Acceptance criteria:

- Unix opt-in PTY smoke test boots a shell, resizes it, and closes cleanly.
- Pipe mode captures stdout/stderr and exit status.
- Windows builds either omit the feature cleanly or return a clear unsupported error.

## Priority Recommendation

Do phases 0-5 first. They directly address the weak PTY management surface
without broadening capability. Phases 6-7 are valuable, but should wait until
the lifecycle, fd, and control protocol are stable.

The first implementation milestone should be:

1. typed lifecycle,
2. deterministic close/revoke,
3. fd budget,
4. structured `tail/run/lifecycle/fdstat`,
5. registry-boundary regression test.

That gives the system most of the operational safety from `../pentesting`
without importing its broader security-lab feature set.
