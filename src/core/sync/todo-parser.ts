
import { type Todo, TODO_STATUS, STATUS_LABEL, TODO_CONSTANTS } from "../../shared/index.js";

/**
 * Parses markdown content into Todo objects
 */
export function parseTodoMd(content: string): Todo[] {
    const lines = content.split('\n');
    const todos: Todo[] = [];

    // Simple ID generator if none exists
    const generateId = (text: string, index: number) => {
        return `${TODO_CONSTANTS.PREFIX.FILE}${index}-${text.substring(0, 10).replace(/[^a-zA-Z0-9]/g, '')}`;
    };

    let index = 0;
    for (const line of lines) {
        // Match: - [ ] Content or - [x] Content or - [/] Content
        // Captures: 1: status char, 2: content
        const match = line.match(/^\s*-\s*\[([ xX\/\-\.])\]\s*(.+)$/);

        if (match) {
            const [, statusChar, text] = match;
            const content = text.trim();

            let status: Todo["status"] = TODO_STATUS.PENDING;
            // Map characters to status
            switch (statusChar.toLowerCase()) {
                case 'x':
                    status = TODO_STATUS.COMPLETED;
                    break;
                case '/':
                case '.': // sometimes used for in progress
                    status = TODO_STATUS.IN_PROGRESS;
                    break;
                case '-':
                    status = TODO_STATUS.CANCELLED;
                    break;
                case ' ':
                default:
                    status = TODO_STATUS.PENDING;
                    break;
            }

            todos.push({
                id: generateId(content, index),
                content: content,
                status: status,
                priority: STATUS_LABEL.MEDIUM as Todo["priority"], // Default priority for file items
                createdAt: new Date()
            });
            index++;
        }
    }
    return todos;
}
