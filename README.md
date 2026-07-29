<div align="center">
  <img src="assets/logo.png" alt="OpenCode Orchestrator logo" width="160" />
  <h1>OpenCode Orchestrator</h1>
  <p>Multi-agent mission control for OpenCode.</p>

  [![MIT License](https://img.shields.io/badge/license-MIT-red.svg)](LICENSE)
  [![npm](https://img.shields.io/npm/v/opencode-orchestrator.svg)](https://www.npmjs.com/package/opencode-orchestrator)
  <!-- VERSION:START -->
  **Version:** `1.7.9`
  <!-- VERSION:END -->
</div>

---

## Highlights

- **A mission loop, not a single prompt.** Commander, Planner, Worker, and Reviewer agents share one mission. The runtime — not the model — decides when work is *done*: it adjudicates at the idle boundary, nudges for missing verification, and on stagnation escalates `DECOMPOSE → RE-PLAN → ASK` instead of looping blindly.
- **Pluggable agent profiles.** Built-in roles plus your own agents defined in `.opencode/agents.json`, with system prompts composed from modular fragments. Retrieval re-weights itself per active role, so a Planner, a Worker, and a Reviewer search the same vault through different lenses.
- **Local-first, human-like memory.** An on-disk Ebbinghaus model with no external vector DB: notes gain strength when recalled and fade when unused, are *de-referenced rather than deleted* (recoverable), and separate when a fact was true (`event_time`) from when it was learned (`ingestion_time`).
- **Memory organized the way yours is.** Notes carry a *kind* — **episodic** (what happened on a mission), **semantic** (facts that outlive it), **procedural** (reusable playbooks with failure pivots). Recurring episodes are promoted into facts and procedures, so the agent recognizes what it already learned instead of re-deriving it.
- **Retrieval by complementary senses.** BM25 lexical + tag + wiki-link graph, fused with Reciprocal Rank Fusion and biased by the active role — and a faded memory naturally sinks while a frequently recalled one rises, so search and memory are one model.
- **Auditable by design.** A bounded mission ledger, a live scratchpad, and an Obsidian-compatible knowledge-map canvas make every decision and piece of evidence inspectable.
- **Safe by default.** Disk writes and destructive maintenance are opt-in; sensitive or malicious memories never enter the prompt.

## 1. Install

```bash
npm install -g opencode-orchestrator
```

The install hook merges OpenCode config instead of replacing it, prefers `opencode.jsonc` when present, preserves existing plugin tuple options, and skips automatic config mutation in CI.

To remove the plugin from OpenCode config:

```bash
npm explore -g opencode-orchestrator -- npm run cleanup:plugin
npm uninstall -g opencode-orchestrator
```

Manual fallback: remove `"opencode-orchestrator"` or `["opencode-orchestrator", {...}]` from the `plugin` array in `opencode.json` or `opencode.jsonc`.

## 2. Configure

Tested compatibility:

1. Node.js `24+`
2. `@opencode-ai/plugin` `1.17.18`
3. `@opencode-ai/sdk` `1.17.18`

OpenCode plugin options belong inside the `plugin` array as `["plugin-name", {...}]` tuples. Configure `agentConcurrency` and `missionLoop` there:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "model": "opencode/gpt-5.1-codex",
  "permission": {
    "question": "allow"
  },
  "agent": {
    "commander": {
      "model": "opencode/gpt-5.1-codex"
    },
    "worker": {
      "model": "anthropic/claude-opus-4-5-20251101"
    }
  },
  "plugin": [
    [
      "opencode-orchestrator",
      {
        "agentConcurrency": {
          "commander": 1,
          "planner": 10,
          "worker": 10,
          "reviewer": 10
        },
        "missionLoop": {
          "ledger": true,
          "markdownMemory": true,
          "maxEvidenceEvents": 20
        }
      }
    ]
  ]
}
```

Model selection follows normal OpenCode inheritance. The plugin does not force a model:

1. Commander uses the global `model` unless `agent.commander.model` is set.
2. Planner, Worker, and Reviewer inherit the invoking primary agent model unless `agent.<name>.model` is set.
3. Generated Commander, Planner, Worker, and Reviewer agents inherit global permissions.
4. Same-name user agent config can still override model, temperature, and specific permission keys.

Plugin options are schema-described in `opencode-orchestrator.schema.json` (generated from the Zod source, shipped in the package) for editor autocomplete and validation. Invalid or missing option fields fall back to defaults rather than failing.

## 3. Run

Inside OpenCode:

```bash
/task "Implement the requested change and verify it"
```

Mission controls:

1. `/task ...` starts a persisted mission loop under `.opencode/`.
2. `Esc`/OpenCode interrupt is respected by idle guards so the plugin does not immediately re-continue an interrupted turn.
3. `/cancel` and `/stop` deactivate the current mission loop.
4. The default mission iteration ceiling is `1,000,000,000`.

Role-aware agent sessions are created or reused on demand: Commander delegates Planner, Worker, and Reviewer tasks into a per-role session pool, then releases or cleans those sessions automatically after completion.

### Authorized Shell Listener TUI

For owned lab machines or explicitly authorized test environments, the bundled Rust CLI can run a multi-session TCP shell listener:

```bash
orchestrator shell-listener --bind 127.0.0.1 --port 4444
```

The listener is intentionally outside the OpenCode JSON-RPC tool surface. It is an operator-driven terminal workflow, not an LLM-callable tool.

Safety defaults:

1. Loopback-only bind by default.
2. Non-loopback bind addresses require `--allow-remote`.
3. Raw stream logs are stored under `.opencode-orchestrator/shell-listener/`.
4. The CLI does not generate payloads, exploit targets, or bypass authentication.

TUI commands:

| Command | Purpose |
| --- | --- |
| `sessions` | Show connected sessions, peer addresses, status, and raw log paths. |
| `use <id>` | Select the active session. |
| `send <text>` | Send one input line to the active session. Use this for login, registry, CDK, or reverse-proxy prompts that need human input. |
| `run <cmd>` | Send a command followed by a unique sentinel marker so completion can be recognized in output. |
| `pty` | Send a manual PTY helper to the active session when the remote environment supports Python. |
| `close [id]` | Close a session. |
| `quit` | Stop the listener UI. |

## 4. How It Works

```text
                    /task input
                         |
                         v
                  +-------------+
           +----->|  Commander  |
           |      +------+------+
           |             | delegates
           |       +-----+------+
           |       v            v
           |  +---------+  +-------------+
           |  | Planner |  | Worker pool |
           |  +----+----+  +--+-------+--+
           |       | writes   | impl  |
           |       v          v       v
           |  +------------------+  +----------+
           |  |  Mission state   |  | Reviewer |
           |  |   (.opencode/)   |  +----+-----+
           |  +------------------+       |
           |                             v
           |  no (keep working)    +-----------+
           +-----------------------+ Verified? |
                                   +-----+-----+
                                         | yes
                                         v
                                       Done
```

| Agent | Purpose |
| --- | --- |
| Commander | Interprets the mission, coordinates agents, and keeps the loop aligned. |
| Planner | Breaks work into ordered steps and tracks dependencies. |
| Worker | Implements scoped file changes with isolated context. |
| Reviewer | Checks completion evidence, tests, and integration risk. |

The mission loop adjudicates continuation at the idle boundary rather than trusting a model's "done":

1. Tool calls are observed to record changed files and verification runs; if files changed with no verification, the continuation prompt emphatically asks the model to run tests/build/lint and cite results (a nudge, never a hard block).
2. Before declaring done the model is asked for a short self-account (scope fit, verification, residual risk).
3. After sustained stagnation the loop stops blind retries and escalates: DECOMPOSE → RE-PLAN → ASK the user.

### Retrieval — finding by complementary senses

A single ranking misses things, so retrieval runs several complementary channels in parallel and fuses them rather than trusting one score:

- **Lexical (BM25)** — exact word matches; strong on code, identifiers, and proper nouns.
- **Tag** — explicit frontmatter classification.
- **Graph (wiki-link BFS)** — pulls in notes that are *contextually* close through `[[links]]` and backlinks, even when the wording differs.

These are merged with Reciprocal Rank Fusion (RRF), which combines by rank position instead of raw score, so notes that several channels agree on rise to the top without hand-tuned scales. It all runs locally — no GPU, no external model, no API call.

**Whoever is searching changes the weighting.** Retrieval is role-aware: a Planner leans on graph/tag structure, a Worker on exact lexical hits, a Reviewer on tag breadth (`src/core/knowledge/retrieval-weights.ts`). Swap the active agent profile and the same query is searched through a different blend of senses; custom profiles can be added via `.opencode/agents.json`. Each memory note also carries a relevance `horizon` (strategic / execution / closure) that tunes how long it stays in play.

Forgetting then feeds back into retrieval — the memory-strength multiplier (below) makes a faded memory sink in the ranking while a frequently recalled one rises, so search and memory behave as one retrieval model rather than two systems.

### Three Kinds of Memory — Episodic, Semantic, Procedural

Not all knowledge is the same *kind* of knowledge, so the store doesn't treat it as one undifferentiated pile. Following how human memory is organized, every note carries a kind:

- **Episodic** — *what happened on a mission*: the objective, the sequence of tool actions, and the outcome. Captured automatically at mission completion from the mission ledger, keyed by objective and the files it touched.
- **Semantic** — *facts that outlive any one mission*: where this repo's auth flow lives, which build step fails without which dependency. Time- and mission-independent.
- **Procedural** — *how to get something done*: a reusable playbook with prerequisites, commands, verification steps, and — the part that matters most — **failure pivots** (what to try when a step fails).

**Kinds are promoted, not merely stored.** When the same episode recurs, it condenses into a semantic fact; when a sequence of steps succeeds repeatedly, it graduates into a procedure. The agent stops re-deriving what it has already learned and starts *recognizing* it — the way expertise forms. Promotion runs inside the opt-in maintenance pass and strips mission-specific detail (paths, secrets) first, so what gets promoted actually generalizes and no secret is embedded in shared knowledge.

Kind also steers retrieval and forgetting: a Worker reaches for procedures, a Planner for semantic facts, and episodic detail fades fast while procedures stay sticky — which is exactly what the strength model below does.

### Ebbinghaus-Inspired Memory

Memory here is not an append-only log: memories carry a *strength* that fades the way human memory does, so the store stays useful instead of drowning in stale notes. The model comes straight from the Ebbinghaus forgetting curve:

- **It decays naturally over time.** The longer a note goes unused, the lower its retrieval strength, so it quietly recedes instead of crowding out fresher knowledge.
- **Different kinds of memory fade at different rates.** Procedural knowledge (`sop`, `workflow`) is sticky; one-off `episode`s fade fast — the same asymmetry that lets people keep a well-worn procedure long after the surrounding details are gone.
- **Recall strengthens memory.** Every retrieval reinforces a note, so frequently used knowledge climbs back up the curve (the spacing / retrieval-practice effect).
- **Nothing is truly deleted — it just stops being referenced.** Strength has a floor and never reaches zero; a faded memory drops out of search surfacing (archived or tombstoned) but the file stays on disk, fully recoverable. This mirrors human forgetting as *retrieval failure*, not erasure.

Concretely, local memory follows this Ebbinghaus-style lifecycle entirely on disk with no external vector DB. The scoring model (single source of truth in `src/core/knowledge/memory-scoring.ts`) applies a per-kind exponential decay so unused notes lose retrieval strength over time (`sop`/`workflow` decay slowly, `episode` fast), while reused notes are reinforced through access counters / `access_ema` and `last_accessed`. Memory is bi-temporal: `event_time` records when a fact was true and `ingestion_time` records when it was learned, so newer facts can supersede older ones by closing their validity window (`valid_to`). Notes without memory metadata keep a neutral score, so ordinary docs rank unchanged. Archived, `sensitive`, malicious, or tombstoned memories stay on disk for auditability but are excluded from prompt injection.

Both destructive and disk-mutating behaviors are off by default and gated behind explicit opt-in flags:

| Flag | Effect |
| --- | --- |
| `OPENCODE_MEMORY_WRITEBACK` (`"1"`/`"true"`), or `new KnowledgeContextProvider({ enableAccessWriteback: true })` | Persist access reinforcement (count/EMA/`last_accessed`) to note frontmatter on search. Off by default — plain search never writes to disk. |
| `runMemoryMaintenance({ ..., dryRun: false })` (optionally gated by `OPENCODE_MEMORY_MAINTENANCE`) | Manually apply tier moves, archiving, and tombstone supersession. Defaults to `dryRun: true` (plan only); never runs automatically on search or index. |

Runtime evidence is written only when enabled:

| Artifact | Purpose |
| --- | --- |
| `.opencode/mission-ledger.jsonl` | Bounded event trail for mission decisions. |
| `.opencode/docs/brain/scratchpad.md` | Generated Markdown memory surface for active missions. |
| `.opencode/docs/brain/knowledge-map.canvas` | Obsidian-compatible visual map of objective, evidence, and verification nodes. |
| `.opencode/docs/brain/memories/*.md` | Generated mission-relevant memory notes indexed by the knowledge retriever. |

## 5. Developer Notes

Local checks that mirror CI (`.github/workflows/ci.yml`), which gates every push and PR:

```bash
# TypeScript
npm run build
npx tsc --noEmit
npm test

# Rust (same gates CI enforces)
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

Regenerate the plugin-options JSON Schema after changing option types: `npm run gen:schema`.

Useful references:

1. OpenCode plugins: https://opencode.ai/docs/plugins/
2. OpenCode config: https://opencode.ai/docs/config/
3. OpenCode keybinds: https://opencode.ai/docs/keybinds/
4. Project issues: https://github.com/agnusdei1207/opencode-orchestrator/issues

Contributions are welcome: open an issue or pull request when you find a bug, compatibility gap, or focused improvement.

Config logs:

| Platform | Path |
| --- | --- |
| Unix | `/tmp/opencode-orchestrator.log` |
| Windows | `%TEMP%\opencode-orchestrator.log` |

## 6. License

MIT License. See [LICENSE](LICENSE).
