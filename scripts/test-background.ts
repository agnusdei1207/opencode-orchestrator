/**
 * Test script for Background Task Manager
 * 
 * Run with: npx tsx scripts/test-background.ts
 */

import { backgroundTaskManager } from "../src/core/background.js";

async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log("🧪 Testing Background Task Manager\n");
    console.log("=".repeat(60));

    // Test 1: Quick command
    console.log("\n📋 Test 1: Quick echo command");
    const task1 = backgroundTaskManager.run({
        command: "echo 'Hello from background!'",
        label: "Quick echo test",
    });
    console.log(`   Started: ${task1.id}`);

    await sleep(500); // Wait for it to complete

    const result1 = backgroundTaskManager.get(task1.id);
    console.log(`   Status: ${result1?.status}`);
    console.log(`   Output: ${result1?.output.trim()}`);

    // Test 2: List all tasks
    console.log("\n📋 Test 2: Multiple concurrent tasks");

    const task2 = backgroundTaskManager.run({
        command: "sleep 2 && echo 'Task 2 done'",
        label: "Slow task",
    });
    console.log(`   Started task2: ${task2.id}`);

    const task3 = backgroundTaskManager.run({
        command: "ls -la",
        label: "List files",
    });
    console.log(`   Started task3: ${task3.id}`);

    await sleep(500);

    console.log("\n📋 Test 3: List all tasks (before slow task finishes)");
    const allTasks = backgroundTaskManager.getAll();
    for (const t of allTasks) {
        const emoji = backgroundTaskManager.getStatusEmoji(t.status);
        const duration = backgroundTaskManager.formatDuration(t);
        console.log(`   ${emoji} ${t.id}: ${t.status} (${duration}) - ${t.label || t.command.substring(0, 30)}`);
    }

    // Test 4: Wait for slow task
    console.log("\n📋 Test 4: Waiting for slow task to complete...");
    let waited = 0;
    while (backgroundTaskManager.get(task2.id)?.status === "running" && waited < 5000) {
        await sleep(500);
        waited += 500;
        console.log(`   ... waiting (${waited}ms elapsed)`);
    }

    const result2 = backgroundTaskManager.get(task2.id);
    console.log(`   Task2 status: ${result2?.status}`);
    console.log(`   Task2 output: ${result2?.output.trim()}`);

    // Test 5: Error handling
    console.log("\n📋 Test 5: Error handling (invalid command)");
    const task4 = backgroundTaskManager.run({
        command: "this_command_does_not_exist",
        label: "Bad command",
    });
    console.log(`   Started: ${task4.id}`);

    await sleep(500);

    const result4 = backgroundTaskManager.get(task4.id);
    console.log(`   Status: ${result4?.status}`);
    console.log(`   Error: ${result4?.errorOutput.substring(0, 100)}`);

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 Final Summary:");
    const finalTasks = backgroundTaskManager.getAll();
    const running = finalTasks.filter(t => t.status === "running").length;
    const done = finalTasks.filter(t => t.status === "done").length;
    const error = finalTasks.filter(t => t.status === "error").length;

    console.log(`   Total tasks: ${finalTasks.length}`);
    console.log(`   ⏳ Running: ${running}`);
    console.log(`   ✅ Done: ${done}`);
    console.log(`   ❌ Error: ${error}`);
    console.log("\n✨ Test complete!\n");
}

main().catch(console.error);
