/**
 * OpenCode Orchestrator plugin entrypoint (OpenCode 2).
 *
 * OpenCode treats every export of this module as a plugin, so only the
 * default export may exist here.
 */

import { setupPlugin } from "./host/plugin.js";

const OrchestratorPlugin = {
    id: "opencode-orchestrator",
    setup: setupPlugin,
};

export default OrchestratorPlugin;
