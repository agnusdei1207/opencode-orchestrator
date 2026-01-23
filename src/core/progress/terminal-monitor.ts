/**
 * TerminalMonitor - Real-time TUI for mission progress
 */

import { stateBroadcaster, MissionState } from "./state-broadcaster.js";
import { TUI_CONSTANTS } from "../../shared/index.js";

export class TerminalMonitor {
    private static instance: TerminalMonitor;
    private lastLineCount: number = 0;
    private active: boolean = false;

    private constructor() {
        stateBroadcaster.subscribe(this.render.bind(this));
    }

    public static getInstance(): TerminalMonitor {
        if (!TerminalMonitor.instance) {
            TerminalMonitor.instance = new TerminalMonitor();
        }
        return TerminalMonitor.instance;
    }

    public start(): void {
        this.active = true;
    }

    public stop(): void {
        this.active = false;
        process.stdout.write("\n");
    }

    private render(state: MissionState): void {
        if (!this.active) return;

        // Console output disabled to prevent TUI/Protocol corruption in OpenCode plugin mode.
        // The mission state is still broadcasted to other listeners (Toasts, logs, etc.)
        /*
        const { COLORS, BAR_WIDTH, LABELS } = TUI_CONSTANTS;
        // ... (preserving logic but disabling side effect)
        */
    }
}
