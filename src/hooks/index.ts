import { HookRegistry } from "./registry.js";
import { SanityCheckHook } from "./features/sanity-check.js";
import { MissionControlHook } from "./features/mission-loop.js";
import { StrictRoleGuardHook } from "./custom/strict-role-guard.js";
import { SecretScannerHook } from "./custom/secret-scanner.js";
import { ResourceControlHook } from "./custom/resource-control.js";

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

    // Order is owned here: safety checks precede observers, and the first
    // completion intervention owns the next turn. The role guard and secret
    // scanner run in every session, including subagents; the rest only in the
    // session that owns an active mission.
    registry.registerChat(missionControl, "stop");

    registry.registerPreTool(roleGuard, "stop");

    registry.registerPostTool(secretScanner, "stop");
    registry.registerPostTool(resourceControl, "continue", true);

    registry.registerDone(sanityCheck);
    registry.registerDone(resourceControl);
}
