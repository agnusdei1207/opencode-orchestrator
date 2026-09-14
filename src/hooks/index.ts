import { HookRegistry } from "./registry.js";
import { SanityCheckHook } from "./features/sanity-check.js";
import { MissionControlHook } from "./features/mission-loop.js";
import { StrictRoleGuardHook } from "./custom/strict-role-guard.js";
import { SecretScannerHook } from "./custom/secret-scanner.js";
import { ResourceControlHook } from "./custom/resource-control.js";
import { MemoryGateHook } from "./custom/memory-gate.js";
import { MetricsHook } from "./custom/metrics.js";

let initialized = false;

export function initializeHooks() {
    if (initialized) return;
    initialized = true;

    const registry = HookRegistry.getInstance();

    const sanityCheck = new SanityCheckHook();
    const missionControl = new MissionControlHook();
    const roleGuard = new StrictRoleGuardHook();
    const secretScanner = new SecretScannerHook();
    const resourceControl = new ResourceControlHook();
    const memoryGate = new MemoryGateHook();
    const metricsHook = new MetricsHook();

    // Order is owned here: safety checks precede observers, and the first
    // completion intervention owns the next turn.
    registry.registerChat(missionControl, "stop");

    registry.registerPreTool(roleGuard, "stop");
    registry.registerPreTool(metricsHook);

    registry.registerPostTool(secretScanner, "stop");
    registry.registerPostTool(resourceControl);
    registry.registerPostTool(memoryGate);
    registry.registerPostTool(metricsHook);

    registry.registerDone(sanityCheck);
    registry.registerDone(resourceControl);
    registry.registerDone(memoryGate);
    registry.registerDone(metricsHook);
}
