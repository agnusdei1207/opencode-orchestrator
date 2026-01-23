
/**
 * Initialize Hooks
 * Registers all default hooks.
 */

import { HookRegistry } from "./registry.js";
import { SanityCheckHook } from "./features/sanity-check.js";
import { MissionControlHook } from "./features/mission-loop.js";
import { StrictRoleGuardHook } from "./custom/strict-role-guard.js";
import { SecretScannerHook } from "./custom/secret-scanner.js";
import { AgentUIHook } from "./custom/agent-ui.js";
import { ResourceControlHook } from "./custom/resource-control.js";
import { UserActivityHook } from "./custom/user-activity.js";
import { MemoryGateHook } from "./custom/memory-gate.js";
import { MetricsHook } from "./custom/metrics.js";

export function initializeHooks() {
    const registry = HookRegistry.getInstance();

    // Features
    const sanityCheck = new SanityCheckHook();
    const missionControl = new MissionControlHook(); // Was MissionLoopHook

    // Custom Hooks
    const roleGuard = new StrictRoleGuardHook();
    const secretScanner = new SecretScannerHook();
    const agentUI = new AgentUIHook();
    const resourceControl = new ResourceControlHook();
    const userActivity = new UserActivityHook();
    const memoryGate = new MemoryGateHook();
    const metricsHook = new MetricsHook();

    // Register Chat
    registry.registerChat(userActivity); // Track activity first
    registry.registerChat(missionControl); // Handle /task
    // registry.registerChat(slashCommand); // Removed: SlashCommandDispatcher deleted

    // Register Post-Tool
    registry.registerPostTool(sanityCheck);
    registry.registerPostTool(secretScanner); // Scan first
    registry.registerPostTool(agentUI); // Decorate second
    registry.registerPostTool(resourceControl); // Control resources (Track + Compact)
    registry.registerPostTool(memoryGate); // Capture tool results for memory
    registry.registerPostTool(metricsHook); // Collect tool metrics

    // Register Pre-Tool
    registry.registerPreTool(roleGuard); // Check logic before tool runs
    registry.registerPreTool(metricsHook); // Capture start times

    // Register Done
    registry.registerDone(sanityCheck);
    registry.registerDone(missionControl); // Handle loop check
    registry.registerDone(resourceControl); // Update stats & Check memory
    registry.registerDone(memoryGate); // Maintain turn memory
    registry.registerDone(metricsHook); // Final metrics capture
}
