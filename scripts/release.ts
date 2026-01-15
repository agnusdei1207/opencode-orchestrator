#!/usr/bin/env node
/**
 * Release script - handles npm publish, git tag, and GitHub release
 * Usage: npx tsx scripts/release.ts
 */

import { execSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dirname, "..");

function run(cmd: string, options?: { cwd?: string }): string {
    console.log(`\n$ ${cmd}`);
    try {
        const result = execSync(cmd, {
            cwd: options?.cwd ?? ROOT,
            encoding: "utf-8",
            stdio: ["inherit", "pipe", "pipe"],
        });
        if (result) console.log(result.trim());
        return result;
    } catch (error: any) {
        console.error(`Error: ${error.message}`);
        if (error.stderr) console.error(error.stderr);
        throw error;
    }
}

function getVersion(): string {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
    return pkg.version;
}

async function main() {
    const version = getVersion();
    const tag = `v${version}`;

    console.log(`\n🚀 Publishing opencode-orchestrator@${version}`);
    console.log("━".repeat(50));

    // 1. Publish to npm
    console.log("\n📦 Step 1: Publishing to npm...");
    run("npm publish --access public");

    // 2. Git add and commit
    console.log("\n📝 Step 2: Git commit...");
    try {
        run("git add -A");
        run(`git commit -m "chore(release): ${tag}" --allow-empty`);
    } catch {
        console.log("Nothing to commit, skipping...");
    }

    // 3. Create git tag
    console.log("\n🏷️  Step 3: Creating git tag...");
    try {
        run(`git tag -a "${tag}" -m "${tag}"`);
    } catch {
        console.log(`Tag ${tag} already exists, skipping...`);
    }

    // 4. Push with tags
    console.log("\n⬆️  Step 4: Pushing to remote...");
    run("git push --follow-tags");

    // 5. Create GitHub release
    console.log("\n🎉 Step 5: Creating GitHub release...");
    try {
        run(`gh release create "${tag}" --title "${tag}" --notes "Release ${tag}" --latest`);
    } catch {
        console.log(`GitHub release ${tag} may already exist, skipping...`);
    }

    console.log("\n" + "━".repeat(50));
    console.log(`✅ Successfully released ${tag}!`);
    console.log(`📦 npm: https://www.npmjs.com/package/opencode-orchestrator`);
    console.log(`🔗 GitHub: https://github.com/agnusdei1207/opencode-orchestrator/releases/tag/${tag}`);
}

main().catch((error) => {
    console.error("\n❌ Release failed:", error.message);
    process.exit(1);
});
