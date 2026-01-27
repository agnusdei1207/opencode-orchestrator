/**
 * Todo Interfaces
 */

export interface TodoVersion {
    version: number;
    timestamp: number;
    author: string;
}

export interface TodoData {
    content: string;
    version: TodoVersion;
}
