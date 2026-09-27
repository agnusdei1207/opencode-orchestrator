export class SessionDeletionUnavailableError extends Error {
    constructor() {
        super("OpenCode 2 plugin session deletion is unavailable");
        this.name = "SessionDeletionUnavailableError";
    }
}
