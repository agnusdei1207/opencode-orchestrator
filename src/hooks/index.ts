/**
 * Initialize Hooks
 * Registers all default hooks with explicit priority and dependency management.
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

    // Instantiate Hooks
    const sanityCheck = new SanityCheckHook();
    const missionControl = new MissionControlHook();
    const roleGuard = new StrictRoleGuardHook();
    const secretScanner = new SecretScannerHook();
    const agentUI = new AgentUIHook();
    const resourceControl = new ResourceControlHook();
    const userActivity = new UserActivityHook();
    const memoryGate = new MemoryGateHook();
    const metricsHook = new MetricsHook();

    // 1. Register Chat Hooks
    registry.registerChat(userActivity, {
        name: "user-activity",
        priority: 10,
        phase: "early"
    });

    registry.registerChat(missionControl, {
        name: "mission-control",
        priority: 20,
        phase: "early",
        dependencies: ["user-activity"],
        errorHandling: "stop"
    });

    // 2. Register Pre-Tool Hooks
    registry.registerPreTool(roleGuard, {
        name: "role-guard",
        priority: 10,
        phase: "early",
        errorHandling: "stop"
    });

    registry.registerPreTool(metricsHook, {
        name: "metrics-pre",
        priority: 90,
        phase: "late"
    });

    // 3. Register Post-Tool Hooks
    registry.registerPostTool(sanityCheck, {
        name: "sanity-check",
        priority: 10,
        phase: "early",
        errorHandling: "stop"
    });

    registry.registerPostTool(secretScanner, {
        name: "secret-scanner",
        priority: 20,
        phase: "early",
        dependencies: ["sanity-check"],
        errorHandling: "stop"
    });

    registry.registerPostTool(agentUI, {
        name: "agent-ui",
        priority: 40,
        phase: "normal"
    });

    registry.registerPostTool(resourceControl, {
        name: "resource-control",
        priority: 50,
        phase: "normal"
    });

    registry.registerPostTool(memoryGate, {
        name: "memory-gate",
        priority: 60,
        phase: "normal"
    });

    registry.registerPostTool(metricsHook, {
        name: "metrics-post",
        priority: 90,
        phase: "late",
        dependencies: ["metrics-pre"]
    });

    // 4. Register Done Hooks
    registry.registerDone(sanityCheck, {
        name: "sanity-check",
        priority: 10,
        phase: "early"
    });

    registry.registerDone(missionControl, {
        name: "mission-control",
        priority: 20,
        phase: "early"
    });

    registry.registerDone(resourceControl, {
        name: "resource-control",
        priority: 50,
        phase: "normal"
    });

    registry.registerDone(memoryGate, {
        name: "memory-gate",
        priority: 60,
        phase: "normal"
    });

    registry.registerDone(metricsHook, {
        name: "metrics-done",
        priority: 90,
        phase: "late"
    });
}
