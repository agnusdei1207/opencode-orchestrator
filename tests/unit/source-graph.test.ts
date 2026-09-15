import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { init, parse } from "es-module-lexer";
import { describe, expect, it } from "vitest";

await init();

const REPO_ROOT = path.resolve(__dirname, "../..");
const SRC_ROOT = path.join(REPO_ROOT, "src");

function collectSourceFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) return collectSourceFiles(absolute);
        return entry.isFile() && entry.name.endsWith(".ts") ? [path.normalize(absolute)] : [];
    });
}

function sourceCandidates(owner: string, specifier: string): string[] {
    const absolute = path.resolve(path.dirname(owner), specifier);
    const extension = path.extname(absolute);
    const sourceBase = [".js", ".mjs", ".cjs"].includes(extension)
        ? absolute.slice(0, -extension.length)
        : absolute;
    return [absolute, `${sourceBase}.ts`, `${absolute}.ts`, path.join(absolute, "index.ts")]
        .map(candidate => path.normalize(candidate));
}

function moduleSpecifiers(source: string): string[] {
    const [imports] = parse(source);
    return imports
        .map(moduleImport => moduleImport.specifier)
        .filter((specifier): specifier is string => typeof specifier === "string");
}

function buildSourceGraph(files: string[]): Map<string, Set<string>> {
    const fileSet = new Set(files);
    return new Map(files.map(file => {
        const source = readFileSync(file, "utf8");
        const dependencies = moduleSpecifiers(source)
            .filter(specifier => specifier.startsWith("."))
            .map(specifier => sourceCandidates(file, specifier).find(candidate => fileSet.has(candidate)))
            .filter((candidate): candidate is string => candidate !== undefined);
        return [file, new Set(dependencies)];
    }));
}

function reachableFrom(graph: Map<string, Set<string>>, entrypoint: string): Set<string> {
    const reached = new Set<string>();
    const pending = [entrypoint];
    while (pending.length > 0) {
        const current = pending.pop()!;
        if (reached.has(current)) continue;
        reached.add(current);
        pending.push(...(graph.get(current) ?? []));
    }
    return reached;
}

function firstCycle(graph: Map<string, Set<string>>): string[] | undefined {
    const visited = new Set<string>();
    const active = new Set<string>();
    const stack: string[] = [];
    function visit(file: string): string[] | undefined {
        if (active.has(file)) return [...stack.slice(stack.indexOf(file)), file];
        if (visited.has(file)) return undefined;
        visited.add(file);
        active.add(file);
        stack.push(file);
        for (const dependency of graph.get(file) ?? []) {
            const cycle = visit(dependency);
            if (cycle) return cycle;
        }
        stack.pop();
        active.delete(file);
        return undefined;
    }
    for (const file of graph.keys()) {
        const cycle = visit(file);
        if (cycle) return cycle;
    }
    return undefined;
}

function relative(files: Iterable<string>): string[] {
    return [...files].map(file => path.relative(REPO_ROOT, file).replaceAll("\\", "/")).sort();
}

describe("production source graph", () => {
    const files = collectSourceFiles(SRC_ROOT);
    const graph = buildSourceGraph(files);

    it("contains no source file disconnected from the shipped entrypoints", () => {
        const entrypoints = ["index.ts", "cli.ts"].map(file => path.join(SRC_ROOT, file));
        const reached = new Set(entrypoints.flatMap(entrypoint => [...reachableFrom(graph, entrypoint)]));
        const unreachable = files.filter(file => !reached.has(file));
        expect(relative(unreachable)).toEqual([]);
    });

    it("contains no circular dependency", () => {
        expect(relative(firstCycle(graph) ?? [])).toEqual([]);
    });
});
