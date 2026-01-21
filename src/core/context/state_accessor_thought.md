
/**
 * Context Window Monitor - State Exports
 */

// Re-export state interface if needed, or provide accessors
import { sessionStates, MonitorState } from "./monitor-state.js"; // We need to move state to a shared file first to avoid circular deps? 
// Actually, let's just export a getter from the main file if we can modifies it.
// But checking the file content from previous turn (Step 235), 'sessionStates' is not exported.

// We need to modify 'src/core/context/context-window-monitor.ts' to export 'sessionStates' or a getter.
// Let's add a public getter for the monitor state.
