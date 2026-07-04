/**
 * Prompt Consistency Guards
 *
 * Structural invariants over the composed agent prompts and the prompt
 * fragment sources. These exist because prompt defects are invisible to
 * type-checking and snapshots alone: a fragment can be exported but never
 * composed (dead prompt), or two fragments can teach the same agent
 * conflicting schemas. Each test here encodes an invariant that was
 * violated at least once in the audit that introduced this file.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

import { AGENTS } from "../../src/agents/definitions.js";
import { AGENT_NAMES } from "../../src/shared/agent/index.js";

const SRC_ROOT = fileURLToPath(new URL("../../src", import.meta.url));
const PROMPT_ROOT = join(SRC_ROOT, "agents", "prompts");

function listFiles(directory: string): string[] {
    const files: string[] = [];
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const fullPath = join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...listFiles(fullPath));
        } else if (entry.isFile() && extname(entry.name) === ".ts") {
            files.push(fullPath);
        }
    }
    return files;
}

const TERMINAL_AGENTS = [
    AGENT_NAMES.PLANNER,
    AGENT_NAMES.WORKER,
    AGENT_NAMES.REVIEWER,
] as const;

const ALL_AGENTS = [AGENT_NAMES.COMMANDER, ...TERMINAL_AGENTS] as const;

describe("Prompt Consistency Guards", () => {
    it("has no dead prompt fragments (every exported const is referenced outside its own file)", () => {
        // A fragment that is exported but composed nowhere is a maintenance
        // trap: edits to it silently do nothing. Every exported constant in
        // the prompts tree must be referenced by at least one other source
        // file (an agent composition or another fragment).
        const promptFiles = listFiles(PROMPT_ROOT).filter(
            (f) => basename(f) !== "index.ts" && basename(f) !== "registry.ts",
        );
        const srcFiles = listFiles(SRC_ROOT).filter((f) => basename(f) !== "index.ts");
        const contents = new Map(srcFiles.map((f) => [f, readFileSync(f, "utf8")]));

        const deadExports: string[] = [];
        for (const file of promptFiles) {
            const source = contents.get(file) ?? readFileSync(file, "utf8");
            const exported = [...source.matchAll(/^export (?:const|function) (\w+)/gm)].map(
                (m) => m[1],
            );
            for (const name of exported) {
                const used = srcFiles.some((other) => {
                    if (other === file) return false;
                    const text = contents.get(other)!;
                    return new RegExp(`\\b${name}\\b`).test(text);
                });
                if (!used) deadExports.push(`${basename(file)} → ${name}`);
            }
        }

        expect(
            deadExports,
            `Dead prompt exports (exported but never composed):\n${deadExports.join("\n")}`,
        ).toEqual([]);
    });

    it("teaches exactly one TODO hierarchy schema (M/T/S) to every agent", () => {
        // todo.md is the shared contract between all four agents. The audit
        // found three competing schemas (M1/T1.1/S1.1.1, G1/P1.1/T1.1.1,
        // T1/S1.1) taught to the same agents. Only the M/T/S scheme may
        // appear in composed prompts.
        for (const name of ALL_AGENTS) {
            const prompt = AGENTS[name].systemPrompt;
            expect(prompt, `${name}: legacy G-level TODO ids`).not.toMatch(/\bG1:/);
            expect(prompt, `${name}: legacy P-level TODO ids`).not.toMatch(/\bP1\.\d/);
        }
        // The agents that create or update todo.md must know the canonical scheme.
        for (const name of [AGENT_NAMES.COMMANDER, AGENT_NAMES.PLANNER, AGENT_NAMES.REVIEWER]) {
            const prompt = AGENTS[name].systemPrompt;
            expect(prompt, `${name}: must teach M/T/S schema`).toMatch(/\bM1\b/);
            expect(prompt, `${name}: must teach M/T/S schema`).toMatch(/\bS1\.\d\.\d/);
        }
    });

    it("never positively instructs a terminal agent to spawn or delegate", () => {
        // Terminal agents (Planner/Worker/Reviewer) must not receive any
        // instruction to USE delegate_task/call_agent — only prohibitions.
        // The audit found the Worker workflow instructing delegate_task use
        // while the Worker forbidden-list banned it (and the tool isn't even
        // granted to workers by prompt-routing).
        for (const name of TERMINAL_AGENTS) {
            const prompt = AGENTS[name].systemPrompt;
            const offending = prompt
                .split("\n")
                .filter((line) => /delegate_task|call_agent/i.test(line))
                // A line counts as a prohibition when it negates the ability
                // (NEVER/not/forbidden/cannot/only) or is the role-matrix row
                // marking the capability "no" for terminal agents.
                .filter((line) => !/NEVER|not|forbidden|only|cannot|\bno\b/i.test(line));
            expect(
                offending,
                `${name}: lines that mention delegation without negation:\n${offending.join("\n")}`,
            ).toEqual([]);
        }
    });

    it("uses each XML section tag at most once per composed prompt", () => {
        // The audit found three unrelated fragments all wrapped in
        // <quality_checklist>, producing duplicate same-named sections whose
        // contents had nothing to do with each other.
        for (const name of ALL_AGENTS) {
            const prompt = AGENTS[name].systemPrompt;
            const opens = [...prompt.matchAll(/^<([a-z_]+)>$/gm)].map((m) => m[1]);
            const counts = new Map<string, number>();
            for (const tag of opens) counts.set(tag, (counts.get(tag) ?? 0) + 1);
            const duplicated = [...counts.entries()].filter(([, n]) => n > 1);
            expect(
                duplicated,
                `${name}: duplicated section tags: ${duplicated.map(([t, n]) => `${t}×${n}`).join(", ")}`,
            ).toEqual([]);
        }
    });

    it("contains no known typos or self-undermining artifacts", () => {
        for (const name of ALL_AGENTS) {
            const prompt = AGENTS[name].systemPrompt;
            expect(prompt, `${name}`).not.toContain("MILRESTONES");
        }
    });

    it("keeps hyper-parallel spawning rules away from terminal agents", () => {
        // HPFA tells the reader to spawn parallel branches. Terminal agents
        // cannot spawn; giving them HPFA sets up "parallelize or fail" vs
        // "never spawn" — an unresolvable contradiction.
        for (const name of TERMINAL_AGENTS) {
            const prompt = AGENTS[name].systemPrompt;
            expect(prompt, `${name}: HPFA leaked into terminal agent`).not.toContain(
                "HYPER-PARALLEL COGNITIVE ARCHITECTURE",
            );
        }
        expect(AGENTS[AGENT_NAMES.COMMANDER].systemPrompt).toContain(
            "HYPER-PARALLEL COGNITIVE ARCHITECTURE",
        );
    });

    it("gives every agent the shared role permission matrix", () => {
        for (const name of ALL_AGENTS) {
            const prompt = AGENTS[name].systemPrompt;
            expect(prompt, `${name}: missing role matrix`).toContain("<role_matrix>");
        }
    });
});
