/**
 * Session prompt injection helpers.
 *
 * Every prompt this plugin pushes into a session that a human is watching is
 * orchestrator-generated, not something the user typed. OpenCode models exactly
 * that distinction with the `synthetic` flag on a text part
 * (`TextPartInput.synthetic`, see `packages/schema/src/v1/session.ts` upstream):
 *
 * - The TUI hides text parts where `synthetic === true` when it renders the
 *   conversation and when it picks the "last user message" for editing
 *   (`packages/tui/src/routes/session/index.tsx`).
 * - The model still receives them: `MessageV2.toModelMessage` only filters on
 *   `ignored`, never on `synthetic`.
 * - OpenCode itself marks its own injected turns this way (post-compaction
 *   auto-continue, "the following tool was executed by the user").
 *
 * So `synthetic: true` is exactly the right flag for continuation, recovery and
 * anomaly prompts: the LLM keeps reading them, the user stops seeing them
 * masquerading as their own input.
 *
 * Delegation prompts sent to a freshly created *subagent* session are
 * deliberately NOT synthetic: they are that session's real opening instruction,
 * and OpenCode derives the session title from the first non-synthetic user
 * message.
 */

import { PART_TYPES } from "../../shared/index.js";

/** A text part accepted by `client.session.prompt`. */
export interface SyntheticTextPart {
    type: typeof PART_TYPES.TEXT;
    text: string;
    /** Hides the part in the TUI while keeping it in the model context. */
    synthetic: true;
}

/** Wrap orchestrator-authored text as a single synthetic prompt part. */
export function syntheticTextPart(text: string): SyntheticTextPart {
    return { type: PART_TYPES.TEXT, text, synthetic: true };
}

/** Wrap several orchestrator-authored prompts as synthetic parts. */
export function syntheticTextParts(texts: readonly string[]): SyntheticTextPart[] {
    return texts.map(syntheticTextPart);
}
