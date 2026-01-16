# OpenCode SDK API Reference

> **Source**: https://opencode.ai/docs/sdk/
> **Last Updated**: 2026-01-17

## Install

```bash
npm install @opencode-ai/sdk
```

## Create Client

```typescript
import { createOpencode } from "@opencode-ai/sdk"

const { client } = await createOpencode()
```

### Client Only (connect to existing instance)

```typescript
import { createOpencodeClient } from "@opencode-ai/sdk"

const client = createOpencodeClient({
    baseUrl: "http://localhost:4096",
})
```

## Types

```typescript
import type { Session, Message, Part } from "@opencode-ai/sdk"
```

All types: https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts

---

## Session APIs

### session.list()
Returns: `Session[]`

### session.get({ path })
```typescript
await client.session.get({ path: { id: "session-id" } })
```
Returns: `Session`

### session.children({ path })
Returns: `Session[]`

### session.create({ body })
```typescript
const session = await client.session.create({
    body: { title: "My session" }
})
```
Returns: `Session`

#### Extended options (used in opencode-orchestrator):
```typescript
await client.session.create({
    body: { parentID: "parent-session-id", title: "Child session" },
    query: { directory: "/path/to/dir" }
})
```

### session.delete({ path })
```typescript
await client.session.delete({ path: { id: "session-id" } })
```
Returns: `boolean`

### session.update({ path, body })
Returns: `Session`

### session.abort({ path })
Returns: `boolean`

### session.messages({ path })
```typescript
const msgs = await client.session.messages({ path: { id: "session-id" } })
```
Returns: `{ info: Message, parts: Part[] }[]`

### session.message({ path })
Returns: `{ info: Message, parts: Part[] }`

### session.prompt({ path, body })
```typescript
// Send prompt and get response
const result = await client.session.prompt({
    path: { id: session.id },
    body: {
        model: { providerID: "anthropic", modelID: "claude-3-5-sonnet-20241022" },
        parts: [{ type: "text", text: "Hello!" }],
    },
})

// Inject context without triggering AI response (noReply: true)
await client.session.prompt({
    path: { id: session.id },
    body: {
        noReply: true,
        parts: [{ type: "text", text: "You are a helpful assistant." }],
    },
})

// Specify agent
await client.session.prompt({
    path: { id: session.id },
    body: {
        agent: "builder",
        parts: [{ type: "text", text: "Build this feature" }],
    },
})
```
Returns: `AssistantMessage`

### session.status()
```typescript
const statusResult = await client.session.status()
// Returns: Record<sessionID, { type: "idle" | "running" | ... }>
```

### session.share({ path })
Returns: `Session`

### session.unshare({ path })
Returns: `Session`

### session.summarize({ path, body })
Returns: `boolean`

### session.command({ path, body })
Returns: `{ info: AssistantMessage, parts: Part[] }`

### session.shell({ path, body })
Returns: `AssistantMessage`

### session.revert({ path, body })
Returns: `Session`

### session.unrevert({ path })
Returns: `Session`

---

## Global APIs

### global.health()
```typescript
const health = await client.global.health()
console.log(health.data.version)
```
Returns: `{ healthy: true, version: string }`

---

## App APIs

### app.log()
```typescript
await client.app.log({
    body: { service: "my-app", level: "info", message: "Operation completed" }
})
```
Returns: `boolean`

### app.agents()
```typescript
const agents = await client.app.agents()
```
Returns: `Agent[]`

---

## Project APIs

### project.list()
Returns: `Project[]`

### project.current()
Returns: `Project`

---

## Config APIs

### config.get()
Returns: `Config`

### config.providers()
Returns: `{ providers: Provider[], default: { [key: string]: string } }`

---

## File APIs

### find.text({ query })
```typescript
const textResults = await client.find.text({
    query: { pattern: "function.*opencode" }
})
```

### find.files({ query })
```typescript
const files = await client.find.files({
    query: { query: "*.ts", type: "file" }
})

const directories = await client.find.files({
    query: { query: "packages", type: "directory", limit: 20 }
})
```
Returns: `string[]`

Options:
- `type`: "file" or "directory"
- `directory`: override project root
- `limit`: max results (1-200)

### find.symbols({ query })
Returns: `Symbol[]`

### file.read({ query })
```typescript
const content = await client.file.read({
    query: { path: "src/index.ts" }
})
```
Returns: `{ type: "raw" | "patch", content: string }`

### file.status({ query? })
Returns: `File[]`

---

## TUI APIs

### tui.appendPrompt({ body })
```typescript
await client.tui.appendPrompt({ body: { text: "Add this to prompt" } })
```

### tui.showToast({ body })
```typescript
await client.tui.showToast({
    body: { message: "Task completed", variant: "success" }
})
```

### tui.openHelp() / openSessions() / openThemes() / openModels()
Returns: `boolean`

### tui.submitPrompt() / clearPrompt()
Returns: `boolean`

### tui.executeCommand({ body })
Returns: `boolean`

---

## Auth APIs

### auth.set({ path, body })
```typescript
await client.auth.set({
    path: { id: "anthropic" },
    body: { type: "api", key: "your-api-key" }
})
```
Returns: `boolean`

---

## Events APIs

### event.subscribe()
```typescript
const events = await client.event.subscribe()
for await (const event of events.stream) {
    console.log("Event:", event.type, event.properties)
}
```

---

## Part Types

Parts in messages can be:
- `{ type: "text", text: string }`
- `{ type: "reasoning", text: string }`
- `{ type: "tool_call", ... }`
- `{ type: "tool_result", ... }`

---

## Error Handling

```typescript
try {
    await client.session.get({ path: { id: "invalid-id" } })
} catch (error) {
    console.error("Failed to get session:", (error as Error).message)
}
```

---

## Usage in opencode-orchestrator

This project uses the following SDK patterns:

```typescript
// Session creation with parent and directory
await client.session.create({
    body: { parentID, title },
    query: { directory }
})

// Prompt with agent
await client.session.prompt({
    path: { id: sessionID },
    body: { agent, parts: [{ type: PART_TYPES.TEXT, text: prompt }] }
})

// Inject context (no AI response)
await client.session.prompt({
    path: { id: sessionID },
    body: { noReply: true, parts: [{ type: PART_TYPES.TEXT, text: message }] }
})

// Get messages
const msgs = await client.session.messages({ path: { id: sessionID } })

// Check session status
const statusResult = await client.session.status()

// Delete session
await client.session.delete({ path: { id: sessionID } })
```
