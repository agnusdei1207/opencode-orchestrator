/**
 * AST Search Result Interface
 */

export interface AstSearchResult {
    file: string;
    line: number;
    column: number;
    content: string;
    context: {
        before: string[];
        after: string[];
    };
}
