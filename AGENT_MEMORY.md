# Agent Memory - OCO Session

## Current Task

Built interactive 3D WebGL Architecture Explorer for `opencode-orchestrator` landing page based on `pentesting/public` reference, with full multi-language support (i18n), OrbitControls, guided scroll tour, and layer isolation filters.

## Last Completed Step

- Added 3D Architecture Explorer badge and interactive browser link to `README.md` header & overview.
- Verified version synchronization with `scripts/sync-readme-version.mjs`.
- Staged, committed, and pushed to `origin/main`.

## Next Exact Step

Ready for user review, commit, or next instructions.

## Incomplete Items And Why

- None.

## Key Decisions

- Modeled the true OpenCode Orchestrator architecture into 6 distinct layers (Interaction & Ingress, Multi-Agent Council, Hybrid Retrieval, Ebbinghaus Memory, Native Rust Tooling, Mission Loop & Verification) and 26 interactive nodes.
- Preserved all Three.js r128 + OrbitControls features: Free explore mode, guided tour mode, layer filters, reset button, and multi-language switcher.
- Updated `scripts/sync-landing.mjs` so both the GitHub Pages deploy directory (`public/`) and repo root (`index.html`, `css/`, `js/`) remain in lockstep.

## Rejected Alternatives

- Rejected keeping static HTML page: the 3D WebGL explorer provides rich interactive visualization of the multi-agent mission loop and Ebbinghaus memory architecture.

## Known Risks

- The npm token was pasted in plaintext into the chat transcript on 2026-07-29 and should be rotated.

## Verification Observed

- `node scripts/sync-landing.mjs` executed cleanly and synced all files.
- `node scripts/build.mjs` succeeded.
- `tsc --noEmit` passed with 0 errors.
- Vitest suite ran: 106 test files passed, 944/944 tests passed.

## Files To Open First Next Session

1. `AGENT_MEMORY.md`
2. `public/index.html`
3. `public/js/scene.js`


