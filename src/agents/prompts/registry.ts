/**
 * Prompt Registry
 *
 * Central composition seam for agent system prompts (Builder-inspired:
 * `builder_app/src/system_prompt.rs` + `template_engine.rs`).
 *
 * Goals:
 * 1. One place that joins prompt sections into a final system prompt.
 * 2. Lightweight `{{var}}` interpolation for runtime context injection.
 * 3. Model-tier "profiles" — a `compact` profile drops sections tagged
 *    `verbose: true`, so weaker/smaller models can be given a leaner prompt
 *    without duplicating prompt text. The default `standard` profile keeps
 *    every section, so existing composed output is unchanged.
 */

export type PromptProfile = "standard" | "compact";

/** A prompt fragment. Plain strings are always kept; tagged sections can be
 *  dropped by profile. */
export interface PromptSection {
    body: string;
    /** Dropped under the `compact` profile. */
    verbose?: boolean;
}

export type PromptFragment = string | PromptSection;

/**
 * Replace `{{key}}` placeholders. Unknown keys are left intact, so calling with
 * no vars is an identity transform on text that has no placeholders.
 */
export function interpolate(
    template: string,
    vars: Record<string, string | number> = {},
): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
        Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match,
    );
}

export interface ComposeOptions {
    profile?: PromptProfile;
    vars?: Record<string, string | number>;
    separator?: string;
}

function bodyOf(fragment: PromptFragment): string {
    return typeof fragment === "string" ? fragment : fragment.body;
}

function keptUnderProfile(fragment: PromptFragment, profile: PromptProfile): boolean {
    if (profile !== "compact") return true;
    return typeof fragment === "string" ? true : !fragment.verbose;
}

/**
 * Compose a final prompt from ordered fragments. With the default `standard`
 * profile, no vars, and the default separator this is exactly
 * `fragments.join("\n\n")` — preserving existing prompt output byte-for-byte.
 */
export function composePrompt(fragments: PromptFragment[], options: ComposeOptions = {}): string {
    const profile = options.profile ?? "standard";
    const separator = options.separator ?? "\n\n";
    const joined = fragments
        .filter((fragment) => keptUnderProfile(fragment, profile))
        .map(bodyOf)
        .join(separator);
    return interpolate(joined, options.vars);
}
