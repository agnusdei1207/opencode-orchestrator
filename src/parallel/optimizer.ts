/**
 * Auto-Parallel Optimizer
 *
 * Optimizes task parallelization by analyzing dependencies and conflicts.
 * Maximizes parallel execution while preventing conflicts.
 */

import type { Task } from "../core/tasks.js";

export interface OptimizationResult {
  tasks: Task[];
  groups: Map<number, string[]>;
  efficiency: number;
  optimizationNotes: string[];
}

/**
 * Auto-Parallel Optimizer analyzes tasks and creates optimal parallel groups
 */
export class ParallelOptimizer {
  /**
   * Optimize tasks for parallel execution
   */
  optimize(tasks: Task[]): OptimizationResult {
    const groups = new Map<number, string[]>();
    const fileGroups = new Map<string, number>();
    const agentGroups = new Map<string, number>();
    let currentGroup = 0;
    const notes: string[] = [];

    // Build dependency graph
    const taskMap = new Map<string, Task>();
    for (const task of tasks) {
      taskMap.set(task.id, task);
    }

    // Process tasks in order
    for (const task of tasks) {
      // Skip if dependencies not satisfied
      if (!this.areDependenciesSatisfied(task, taskMap)) {
        notes.push("Task " + task.id + " has unresolved dependencies");
        continue;
      }

      // Determine optimal group
      const fileGroup = fileGroups.get(task.file);
      const agentGroup = agentGroups.get(task.agent);
      const maxGroup = Math.max(fileGroup || 0, agentGroup || 0);

      // Start new group if needed
      if (maxGroup > currentGroup) {
        currentGroup = maxGroup;
      }

      // Assign to group
      const groupTasks = groups.get(currentGroup) || [];
      groupTasks.push(task.id);
      groups.set(currentGroup, groupTasks);

      // Mark file and agent as used in this group
      if (task.file) {
        fileGroups.set(task.file, currentGroup);
      }
      agentGroups.set(task.type, currentGroup);

      // Increment group for next task
      currentGroup++;
    }

    // Calculate efficiency
    const totalTasks = tasks.length;
    const totalGroups = groups.size;
    const efficiency = totalTasks / Math.max(totalGroups, 1);

    return {
      tasks,
      groups,
      efficiency: Math.min(efficiency, 1.0),
      optimizationNotes: notes,
    };
  }

  /**
   * Check if task dependencies are satisfied
   */
  private areDependenciesSatisfied(task: Task, taskMap: Map<string, Task>): boolean {
    for (const depId of task.dependencies) {
      const depTask = taskMap.get(depId);
      if (!depTask) {
        return false;
      }
      if (depTask.status !== "completed") {
        return false;
      }
    }
    return true;
  }

  /**
   * Format optimization result for display
   */
  formatResult(result: OptimizationResult): string {
    let output = "📊 **Parallel Optimization**\n";
    output += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    output += `Efficiency: ${(result.efficiency * 100).toFixed(1)}% (${result.groups.size} groups for ${result.tasks.length} tasks)\n\n`;

    // Show groups
    for (const [groupNum, taskIds] of result.groups) {
      const group = Number(groupNum);
      output += `Group ${group + 1}: ${taskIds.join(", ")}\n`;
    }

    // Show optimization notes
    if (result.optimizationNotes.length > 0) {
      output += "\n📝 **Notes**:\n";
      for (const note of result.optimizationNotes) {
        output += "  • " + note + "\n";
      }
    }

    return output;
  }

  /**
   * Get conflict analysis
   */
  analyzeConflicts(tasks: Task[]): Map<string, string[]> {
    const conflicts = new Map<string, string[]>();

    // File conflicts
    const fileMap = new Map<string, string[]>();
    for (const task of tasks) {
      if (task.file) {
        const fileTasks = fileMap.get(task.file) || [];
        fileTasks.push(task.id);
        fileMap.set(task.file, fileTasks);

        if (fileTasks.length > 1) {
          conflicts.set(`file:${task.file}`, fileTasks);
        }
      }
    }

    return conflicts;
  }

  /**
   * Suggest task reordering for better parallelism
   */
  suggestReordering(tasks: Task[]): Task[] {
    const reordered = [...tasks];

    // Move inspector tasks to end
    reordered.sort((a, b) => {
      const aIsInspector = a.agent === "inspector";
      const bIsInspector = b.agent === "inspector";

      if (aIsInspector && !bIsInspector) {
        return 1;
      }
      if (!aIsInspector && bIsInspector) {
        return -1;
      }
      return 0;
    });

    return reordered;
  }

  /**
   * Calculate parallelization potential
   */
  calculateParallelizationPotential(tasks: Task[]): {
    current: number;
    optimal: number;
    improvement: number;
  } {
    const fileAgents = new Set<string>();

    for (const task of tasks) {
      if (task.file) {
        fileAgents.add(`${task.file}:${task.agent}`);
      } else {
        fileAgents.add(task.agent);
      }
    }

    const current = tasks.length;
    const optimal = fileAgents.size;
    const improvement = optimal > current ? ((optimal - current) / current) * 100 : 0;

    return {
      current,
      optimal,
      improvement: Math.max(0, improvement),
    };
  }
}

export const parallelOptimizer = new ParallelOptimizer();
