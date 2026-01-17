/**
 * Task Input Interface
 */

export interface TaskInput {
    description: string;
    level: number;
    parentId?: string;
    agent?: string;
    parallelGroup?: string;
    dependsOn?: string[];
}
