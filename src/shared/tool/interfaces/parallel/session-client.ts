/**
 * Session Client Interface
 */

export interface SessionClient {
    create: (opts: { body: { parentID: string; title: string }; query: { directory: string } }) => Promise<{ data?: { id: string }; error?: string }>;
    prompt: (opts: { path: { id: string }; body: { agent: string; tools?: Record<string, boolean>; parts: { type: string; text: string }[] } }) => Promise<{ error?: string }>;
    messages: (opts: { path: { id: string } }) => Promise<{ data?: unknown[]; error?: string }>;
    status: () => Promise<{ data?: Record<string, { type: string }> }>;
}
