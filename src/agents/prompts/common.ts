import { PATHS } from "../../shared/index.js";

export const WORKING_DISCIPLINE = `Read the relevant files and any mission context before changing anything, and preserve unrelated work. Use the project's real build/test commands and the installed tools; never invent APIs or claim checks you did not run. Use native OpenCode tools for exploration and edits and webfetch for external docs when available; if a capability is missing, say so and use a supported alternative.
Keep changes focused and synchronize affected tests, types, imports, configuration, and documentation. For behavior changes, demonstrate a failing regression test, fix it, and keep the test. Report what you observed, failed checks, and what remains.`;

// These files remain the completion authority until the mission-state migration ships.
export const MISSION_CONTRACT = `## Mission continuity and verification
Read ${PATHS.TODO}, ${PATHS.CONTEXT}, ${PATHS.STATUS}, and ${PATHS.SYNC_ISSUES} when present; missing or unreadable state is not completion. During an active mission keep the goal, next action, blockers, and evidence current in those files. Questions and standalone reviews need no mission files.
TODO schema:
## M1: Goal | status: in_progress
### T1.1: Deliverable | status: in_progress
- [ ] S1.1.1: Concrete action
Mark a leaf [x] only after tool-based verification and a parent status: completed only when every child is verified. Keep unfinished items and dependencies visible. Commander updates verified items directly; a delegated Reviewer updates only its assigned scope.
Before concluding a mission: every TODO item verified, ${PATHS.SYNC_ISSUES} resolved, every item in .opencode/verification-checklist.md (if present) passing, and the project's build and tests run with evidence. An empty file is not proof, and running delegated work is not done.
Respect user pause, abort, and changed instructions. When blocked, ask only when question permission allows it; otherwise report the blocker and keep the next action. Completion reports state outcome, evidence, and limitations.`;

export const DELEGATED_SCOPE = `Complete the assigned scope and report back to Commander. You are a terminal agent: never spawn subagents. Stay within your assigned files and tell Commander if the work needs more. Return changed files or findings, the verification commands you ran with their results, and unresolved issues.`;
