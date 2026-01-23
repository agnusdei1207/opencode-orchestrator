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

        const { COLORS, BAR_WIDTH, LABELS } = TUI_CONSTANTS;

        // Move cursor up to overwrite previous render
        if (this.lastLineCount > 0) {
            process.stdout.write(`\x1b[${this.lastLineCount}A`);
        }

        let output = "";

        // 1. Mission Progress Bar
        const filledWidth = Math.round((state.progress.percentage / 100) * BAR_WIDTH);
        const bar = "█".repeat(filledWidth) + "░".repeat(BAR_WIDTH - filledWidth);

        output += `${COLORS.BOLD}${COLORS.PROGRESS}${LABELS.PROGRESS_TITLE}: [${bar}] ${state.progress.percentage}% ${COLORS.RESET}\n`;
        output += `Tasks: ${state.progress.completedTasks}/${state.progress.totalTasks} completed\n\n`;

        // 2. Active Agents
        if (state.activeAgents.length > 0) {
            output += `${COLORS.BOLD}${LABELS.AGENT_TITLE}:${COLORS.RESET}\n`;
            state.activeAgents.forEach(agent => {
                const desc = agent.currentTask && agent.currentTask.length > 50
                    ? agent.currentTask.substring(0, 47) + "..."
                    : agent.currentTask || LABELS.IDLE;
                output += `  ${COLORS.AGENT}●${COLORS.RESET} ${COLORS.BOLD}${agent.type}${COLORS.RESET}: ${desc}\n`;
            });
            output += "\n";
        } else {
            output += `${COLORS.DIM}${LABELS.WAITING}${COLORS.RESET}\n\n`;
        }

        const lines = output.split("\n");
        this.lastLineCount = lines.length - 1;

        process.stdout.write(output);
    }
}
