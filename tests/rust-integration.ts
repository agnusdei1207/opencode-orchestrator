/**
 * Rust Tool Integration Test
 * 
 * Tests that TypeScript can successfully call Rust tools
 */

import { callRustTool } from "../src/tools/rust.js";
import { existsSync } from "fs";
import { getBinaryPath } from "../src/utils/binary.js";

async function testRustIntegration() {
    console.log("=== Rust Tool Integration Test ===\n");

    // 1. Check binary exists
    const binaryPath = getBinaryPath();
    console.log(`1. Binary path: ${binaryPath}`);
    console.log(`   Exists: ${existsSync(binaryPath) ? "✅ YES" : "❌ NO"}`);

    if (!existsSync(binaryPath)) {
        console.log("\n❌ Binary not found. Build with: cargo build --release");
        console.log("   Or run: npm run build:rust (if script exists)");
        process.exit(1);
    }

    // 2. Test grep_search
    console.log("\n2. Testing grep_search...");
    try {
        const grepResult = await callRustTool("grep_search", {
            pattern: "export",
            directory: "./src",
        });
        const parsed = JSON.parse(grepResult);
        if (parsed.error) {
            console.log(`   ❌ Error: ${parsed.error}`);
        } else {
            console.log(`   ✅ grep_search works!`);
            console.log(`   Results preview: ${grepResult.substring(0, 200)}...`);
        }
    } catch (e) {
        console.log(`   ❌ Exception: ${e}`);
    }

    // 3. Test glob_search
    console.log("\n3. Testing glob_search...");
    try {
        const globResult = await callRustTool("glob_search", {
            pattern: "**/*.ts",
            directory: "./src",
        });
        const parsed = JSON.parse(globResult);
        if (parsed.error) {
            console.log(`   ❌ Error: ${parsed.error}`);
        } else {
            console.log(`   ✅ glob_search works!`);
            console.log(`   Results preview: ${globResult.substring(0, 200)}...`);
        }
    } catch (e) {
        console.log(`   ❌ Exception: ${e}`);
    }

    // 4. Test mgrep (multi-pattern search)
    console.log("\n4. Testing mgrep (multi-pattern parallel search)...");
    try {
        const mgrepResult = await callRustTool("mgrep", {
            patterns: ["export", "import", "const"],
            directory: "./src",
        });
        const parsed = JSON.parse(mgrepResult);
        if (parsed.error) {
            console.log(`   ❌ Error: ${parsed.error}`);
        } else {
            console.log(`   ✅ mgrep works!`);
            console.log(`   Patterns searched: ${parsed.patterns_searched}`);
            console.log(`   Results preview: ${mgrepResult.substring(0, 300)}...`);
        }
    } catch (e) {
        console.log(`   ❌ Exception: ${e}`);
    }

    // 5. Summary
    console.log("\n=== Test Complete ===");
}

testRustIntegration().catch(console.error);
