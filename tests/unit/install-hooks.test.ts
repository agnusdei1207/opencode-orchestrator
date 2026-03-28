import { describe, expect, it } from "vitest";
import { mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "../harness";

const repoRoot = path.resolve(__dirname, "../..");
const runnerPath = path.join(repoRoot, "scripts", "run-install-hook.mjs");
const postinstallPath = path.join(repoRoot, "scripts", "postinstall.ts");
const preuninstallPath = path.join(repoRoot, "scripts", "preuninstall.ts");

function runNode(args: string[], cwd: string, env: NodeJS.ProcessEnv = {}) {
    return spawnSync(process.execPath, args, {
        cwd,
        env: { ...process.env, ...env },
        encoding: "utf8",
    });
}

describe("install hook bootstrap", () => {
    it("falls back to source TypeScript hook when dist is missing", async () => {
        await using tmp = await tmpdir({ prefix: "install-hook-runner-" });
        const scriptsDir = path.join(tmp.path, "scripts");
        mkdirSync(scriptsDir, { recursive: true });

        writeFileSync(path.join(scriptsDir, "run-install-hook.mjs"), readFileSync(runnerPath, "utf8"));
        writeFileSync(
            path.join(scriptsDir, "postinstall.ts"),
            'console.log("source hook executed");\n'
        );

        const result = runNode(
            [path.join("scripts", "run-install-hook.mjs"), "postinstall"],
            tmp.path
        );

        expect(result.status).toBe(0);
        expect(result.stdout).toContain("source hook executed");
    });

    it("prefers built dist hook when available", async () => {
        await using tmp = await tmpdir({ prefix: "install-hook-runner-" });
        const scriptsDir = path.join(tmp.path, "scripts");
        const distScriptsDir = path.join(tmp.path, "dist", "scripts");
        mkdirSync(scriptsDir, { recursive: true });
        mkdirSync(distScriptsDir, { recursive: true });

        writeFileSync(path.join(scriptsDir, "run-install-hook.mjs"), readFileSync(runnerPath, "utf8"));
        writeFileSync(
            path.join(scriptsDir, "postinstall.ts"),
            'console.log("source hook executed");\n'
        );
        writeFileSync(
            path.join(distScriptsDir, "postinstall.js"),
            'console.log("dist hook executed");\n'
        );

        const result = runNode(
            [path.join("scripts", "run-install-hook.mjs"), "postinstall"],
            tmp.path
        );

        expect(result.status).toBe(0);
        expect(result.stdout).toContain("dist hook executed");
        expect(result.stdout).not.toContain("source hook executed");
    });

    it("skips gracefully when no hook entrypoint exists", async () => {
        await using tmp = await tmpdir({ prefix: "install-hook-runner-" });
        const scriptsDir = path.join(tmp.path, "scripts");
        mkdirSync(scriptsDir, { recursive: true });
        writeFileSync(path.join(scriptsDir, "run-install-hook.mjs"), readFileSync(runnerPath, "utf8"));

        const result = runNode(
            [path.join("scripts", "run-install-hook.mjs"), "postinstall"],
            tmp.path
        );

        expect(result.status).toBe(0);
        expect(result.stdout).toContain("postinstall entrypoint not found");
    });

    it("fails for an unknown hook name", async () => {
        const result = runNode([runnerPath, "unknown-hook"], repoRoot);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain("Unknown install hook");
    });
});

describe("install hook scripts", () => {
    it("postinstall creates opencode.jsonc by default for a fresh config", async () => {
        await using tmp = await tmpdir({ prefix: "postinstall-jsonc-" });
        const configRoot = path.join(tmp.path, "xdg");

        const result = runNode(
            ["--experimental-strip-types", postinstallPath],
            repoRoot,
            { XDG_CONFIG_HOME: configRoot, HOME: tmp.path }
        );

        const createdConfig = path.join(configRoot, "opencode", "opencode.jsonc");
        expect(result.status).toBe(0);
        expect(existsSync(createdConfig)).toBe(true);
        expect(existsSync(path.join(configRoot, "opencode", "opencode.json"))).toBe(false);
    });

    it("postinstall updates existing jsonc config without disturbing sibling plugins", async () => {
        await using tmp = await tmpdir({ prefix: "postinstall-jsonc-" });
        const configDir = path.join(tmp.path, "xdg", "opencode");
        const configFile = path.join(configDir, "opencode.jsonc");
        mkdirSync(configDir, { recursive: true });
        writeFileSync(
            configFile,
            [
                "{",
                "  // keep this comment",
                '  "plugin": ["oh-my-openagent@latest"]',
                "}",
                "",
            ].join("\n")
        );

        const result = runNode(
            ["--experimental-strip-types", postinstallPath],
            repoRoot,
            { XDG_CONFIG_HOME: path.join(tmp.path, "xdg"), HOME: tmp.path }
        );

        const updated = readFileSync(configFile, "utf8");
        expect(result.status).toBe(0);
        expect(updated).toContain("// keep this comment");
        expect(updated).toContain('"oh-my-openagent@latest"');
        expect(updated).toContain('"opencode-orchestrator"');
    });

    it("postinstall exits cleanly in CI without writing config", async () => {
        await using tmp = await tmpdir({ prefix: "postinstall-ci-" });
        const configRoot = path.join(tmp.path, "xdg");

        const result = runNode(
            ["--experimental-strip-types", postinstallPath],
            repoRoot,
            { CI: "true", XDG_CONFIG_HOME: configRoot, HOME: tmp.path }
        );

        expect(result.status).toBe(0);
        expect(result.stdout).toContain("Skipping automatic plugin registration");
        expect(existsSync(path.join(configRoot, "opencode", "opencode.json"))).toBe(false);
    });

    it("preuninstall exits cleanly in CI without mutating config", async () => {
        await using tmp = await tmpdir({ prefix: "preuninstall-ci-" });
        const configDir = path.join(tmp.path, "xdg", "opencode");
        const configFile = path.join(configDir, "opencode.json");
        mkdirSync(configDir, { recursive: true });
        writeFileSync(configFile, JSON.stringify({ plugin: ["opencode-orchestrator"] }, null, 2));

        const before = readFileSync(configFile, "utf8");
        const result = runNode(
            ["--experimental-strip-types", preuninstallPath],
            repoRoot,
            { CI: "true", XDG_CONFIG_HOME: path.join(tmp.path, "xdg"), HOME: tmp.path }
        );

        expect(result.status).toBe(0);
        expect(result.stdout).toContain("Skipping automatic plugin cleanup");
        expect(readFileSync(configFile, "utf8")).toBe(before);
    });

    it("preuninstall does not create backups when our plugin is absent", async () => {
        await using tmp = await tmpdir({ prefix: "preuninstall-noop-" });
        const configDir = path.join(tmp.path, "xdg", "opencode");
        const configFile = path.join(configDir, "opencode.jsonc");
        mkdirSync(configDir, { recursive: true });
        writeFileSync(
            configFile,
            JSON.stringify({ plugin: ["oh-my-openagent@latest"] }, null, 2)
        );

        const result = runNode(
            ["--experimental-strip-types", preuninstallPath],
            repoRoot,
            { XDG_CONFIG_HOME: path.join(tmp.path, "xdg"), HOME: tmp.path }
        );

        expect(result.status).toBe(0);
        expect(result.stdout).toContain("Nothing to clean up");
        expect(readFileSync(configFile, "utf8")).toContain("oh-my-openagent@latest");
        expect(readFileSync(configFile, "utf8")).not.toContain("opencode-orchestrator");
        const backupFiles = readdirSync(configDir).filter((entry) => entry.includes(".backup."));
        expect(backupFiles).toHaveLength(0);
        expect(result.stdout).not.toContain("Backup created:");
    });

    it("preuninstall removes only our plugin from jsonc config and preserves comments", async () => {
        await using tmp = await tmpdir({ prefix: "preuninstall-jsonc-" });
        const configDir = path.join(tmp.path, "xdg", "opencode");
        const configFile = path.join(configDir, "opencode.jsonc");
        mkdirSync(configDir, { recursive: true });
        writeFileSync(
            configFile,
            [
                "{",
                "  // keep this comment",
                '  "plugin": ["oh-my-openagent@latest", "opencode-orchestrator"]',
                "}",
                "",
            ].join("\n")
        );

        const result = runNode(
            ["--experimental-strip-types", preuninstallPath],
            repoRoot,
            { XDG_CONFIG_HOME: path.join(tmp.path, "xdg"), HOME: tmp.path }
        );

        const updated = readFileSync(configFile, "utf8");
        expect(result.status).toBe(0);
        expect(updated).toContain("// keep this comment");
        expect(updated).toContain('"oh-my-openagent@latest"');
        expect(updated).not.toContain('"opencode-orchestrator"');
    });

    it("preuninstall cleans duplicate registrations across config roots without touching sibling plugins", async () => {
        await using tmp = await tmpdir({ prefix: "preuninstall-multi-root-" });
        const xdgConfigDir = path.join(tmp.path, "xdg", "opencode");
        const homeConfigDir = path.join(tmp.path, ".config", "opencode");
        const xdgConfigFile = path.join(xdgConfigDir, "opencode.jsonc");
        const homeConfigFile = path.join(homeConfigDir, "opencode.json");
        mkdirSync(xdgConfigDir, { recursive: true });
        mkdirSync(homeConfigDir, { recursive: true });

        writeFileSync(
            xdgConfigFile,
            [
                "{",
                '  "plugin": ["oh-my-openagent@latest", "opencode-orchestrator"]',
                "}",
                "",
            ].join("\n")
        );
        writeFileSync(
            homeConfigFile,
            JSON.stringify({ plugin: ["opencode-orchestrator@1.2.66", "other-plugin"] }, null, 2)
        );

        const result = runNode(
            ["--experimental-strip-types", preuninstallPath],
            repoRoot,
            { XDG_CONFIG_HOME: path.join(tmp.path, "xdg"), HOME: tmp.path }
        );

        expect(result.status).toBe(0);
        expect(readFileSync(xdgConfigFile, "utf8")).toContain('"oh-my-openagent@latest"');
        expect(readFileSync(xdgConfigFile, "utf8")).not.toContain('"opencode-orchestrator"');
        expect(readFileSync(homeConfigFile, "utf8")).toContain('"other-plugin"');
        expect(readFileSync(homeConfigFile, "utf8")).not.toContain('"opencode-orchestrator@1.2.66"');
        expect(result.stdout).toContain(`Plugin removed: ${xdgConfigFile}`);
        expect(result.stdout).toContain(`Plugin removed: ${homeConfigFile}`);
    });
});
