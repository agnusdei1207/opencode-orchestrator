# OpenCode Plugin Troubleshooting Guide

## Problem
Plugin commands (e.g., `/auto`) not appearing in OpenCode after installation.

---

## Root Cause Analysis

### How OpenCode Loads Plugins

1. **Config File**: `~/.config/opencode/opencode.json`
   ```json
   {
     "plugin": ["package-name-or-path"]
   }
   ```

2. **Plugin Resolution**: OpenCode resolves the plugin from:
   - Package name (e.g., `"opencode-orchestrator"`) → looks in `node_modules`
   - Absolute path (e.g., `/path/to/plugin`)

3. **Plugin Entry Point**: Must export a **default function** that returns plugin hooks and tools.

---

## Plugin Export Structure

### 1. Main Plugin Export
```typescript
// src/index.ts
const OrchestratorPlugin: Plugin = async (ctx) => {
  return {
    tool: {
      slashcommand: createSlashcommandTool(),
      // ... other tools
    },
    "chat.message": async (input, output) => { ... },
    "tool.execute.before": async (input, output) => { ... },
    "tool.execute.after": async (input, output) => { ... },
  };
};

export default OrchestratorPlugin;
```

### 2. Slashcommand Tool
The `/` commands are handled by a **tool** named `slashcommand`:
```typescript
tool: {
  slashcommand: createSlashcommandTool(),
}
```

### 3. Package.json Configuration
```json
{
  "main": "dist/index.js",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"]
}
```

---

## Critical Fixes

### 1. Plugin Not Loading? Use Absolute Paths!
OpenCode often fails to resolve plugins by package name depending on the user's Node environment (nvm, global prefix, etc.).
**Solution**: Always register the **absolute path** to the plugin in `opencode.json`.

```typescript
// scripts/postinstall.ts
function getPluginPath() {
    try {
        const packagePath = new URL(".", import.meta.url).pathname;
        // ... resolve to package root ...
        return packageRoot; // e.g., /Users/user/.../opencode-orchestrator
    } catch {
        return "opencode-orchestrator"; // Fallback
    }
}
// Register this path!
config.plugin.push(pluginPath);
```

### 2. Commands Not Appearing in Menu? Add Config Handler!
Registering a `slashcommand` tool makes the command *work* if you type it, but it **won't appear in the autocomplete menu** unless you register it via the `config` handler with metadata.

**Required Handler in `src/index.ts`:**
```typescript
return {
    tool: { ... },
    
    // MANDATORY for Autocomplete Menu
    config: async (config: Record<string, unknown>) => {
        config.command = {
            ...(config.command as object),
            "auto": {
                description: "Autonomous execution",
                template: "...",
                argumentHint: '"task description"' // Optional but recommended
            }
        };
    }
};
```

### 3. Build Target
Ensure your plugin is built for **Node.js** explicitly.

### 4. Bundling Dependencies
Make sure your build script bundles dependencies (except `node_modules` if externals are set correctly).
For compatibility:
```bash
npx esbuild src/index.ts --bundle --outfile=dist/index.js --platform=node --format=esm --packages=external
```

---

## Checklist for Plugin Issues

### 1. Verify Installation
```bash
npm list opencode-orchestrator
# Should show the package is installed
```

### 2. Check Config File
```bash
cat ~/.config/opencode/opencode.json
# Should contain: {"plugin":["opencode-orchestrator"]}
```

### 3. Verify Plugin Path Resolution
```bash
node -e "console.log(require.resolve('opencode-orchestrator'))"
# Should output the path to dist/index.js
```

### 4. Check Plugin Export
```bash
node -e "import('opencode-orchestrator').then(m => console.log(typeof m.default))"
# Should output: function
```

### 5. Check for Errors
Run OpenCode with debug mode (if available):
```bash
DEBUG=* opencode
```

---

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Commands not appearing | Plugin not loaded | Check config file path |
| Plugin not found | Wrong package name | Use exact npm package name |
| Module not found | Missing dist folder | Run `npm run build` |
| Export error | Wrong export format | Must use `export default` |

---

## Postinstall Script Best Practices

The postinstall script should:
1. Create config directory if not exists
2. Register the **package name** (not path) in plugin array
3. Handle existing config gracefully

```typescript
// Correct registration
config.plugin.push("opencode-orchestrator");

// NOT this (path changes per environment)
config.plugin.push("/absolute/path/to/package");
```

---

## Environment Variables

OpenCode may use these for plugin resolution:
- `NODE_PATH`: Additional paths for module resolution
- `OPENCODE_PLUGIN_PATH`: Custom plugin search path

---

## Agent Registration (2026-01-14)

### Problem: Agents Not Appearing in OpenCode UI

If your agents don't appear in the bottom bar (like "Build · glm-4.7"), you need to register them via the `config` handler.

### Solution: Add Agent Config

```typescript
return {
    tool: { ... },
    
    config: async (config: Record<string, unknown>) => {
        const existingAgents = (config.agent as Record<string, unknown>) ?? {};
        
        // Register agents for OpenCode UI display
        const orchestratorAgents: Record<string, unknown> = {
            orchestrator: {
                name: "Orchestrator",
                description: "Mission Commander",
                systemPrompt: "...",
            },
            coder: {
                name: "Coder",
                description: "Implementation specialist",
                systemPrompt: "...",
            },
            // ... other agents
        };

        config.agent = {
            ...orchestratorAgents,
            ...existingAgents,
        };
    }
};
```

### How It Works

1. **Agent Registration**: The `config.agent` object registers agents with OpenCode
2. **UI Display**: Registered agents appear in the bottom bar
3. **Tab Switching**: Users can press `tab` to switch between agents

### Verification

After installation, check if agents are registered:
```bash
cat ~/.config/opencode/opencode.json | jq '.agent'
# Should show: { "orchestrator": {...}, "coder": {...}, ... }
```

---

## Local Development Testing

### Test Local Build Before Publishing

1. **Uninstall global package**:
   ```bash
   npm uninstall -g opencode-orchestrator
   ```

2. **Build locally**:
   ```bash
   npm run build:js
   ```

3. **Install from local directory**:
   ```bash
   npm install -g .
   ```

4. **Restart OpenCode**:
   ```bash
   opencode
   ```

5. **Verify commands and agents**:
   - Type `/task` - should appear in autocomplete
   - Press `tab` - should see agents in list

6. **If working, publish**:
   ```bash
   npm run release:patch
   ```

---

## Relentless Loop (Auto-Continue)

### How It Works

1. **Auto-Activation**: Selecting Orchestrator agent or using `/task` activates mission mode
2. **Auto-Continue**: After each response, system injects "continue" if mission not complete
3. **Completion Signals**:
   - `✅ MISSION COMPLETE`
   - `All tasks completed`

### Stopping the Loop

- Type `/stop` or `/cancel`
- Wait for `✅ MISSION COMPLETE`
- Maximum 1000 iterations (safety limit)

---

## UI Corruption: Unsupported Hook (2026-01-16)

### Problem: OpenCode UI Breaks When Plugin Loads

After enabling the plugin, OpenCode UI displays garbled text like:
- `tools: input.tools,`
- Random code fragments in the interface
- Chat interface becomes unusable

### Root Cause

Using **unsupported hooks** in the plugin return object causes OpenCode to misinterpret the plugin structure and corrupt the UI rendering.

**The problematic hook:**
```typescript
// ❌ DO NOT USE - This hook does NOT exist in OpenCode Plugin API
return {
    tool: { ... },
    
    // THIS CAUSES UI CORRUPTION
    "assistant.done": async (input, output) => {
        // ... relentless loop logic
    },
};
```

### Solution

Remove any hooks that are not officially documented in the OpenCode Plugin API.

**Supported hooks only:**
```typescript
// ✅ CORRECT - Only use documented hooks
return {
    tool: { ... },
    config: async (config) => { ... },
    "chat.message": async (input, output) => { ... },
    "tool.execute.before": async (input, output) => { ... },
    "tool.execute.after": async (input, output) => { ... },
    event: async (input) => { ... },
};
```

### Verification

After fixing, restart OpenCode and check:
1. UI renders correctly
2. Plugin loads without errors: `[orchestrator] vX.X.X loaded`
3. Commands appear in autocomplete

### Notes

- The "relentless loop" feature that used `assistant.done` needs to be reimplemented using `tool.execute.after` or `event` hooks
- Always check the official [OpenCode Plugin API](https://opencode.ai/docs/plugins) for supported hooks

---

## References

- [OpenCode Plugin API](https://opencode.ai/docs/plugins)
- [@opencode-ai/plugin package](https://www.npmjs.com/package/@opencode-ai/plugin)

---

**Last Updated**: 2026-01-16
