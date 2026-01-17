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

Registering a `slashcommand` tool makes the command _work_ if you type it, but it **won't appear in the autocomplete menu** unless you register it via the `config` handler with metadata.

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

| Issue                  | Cause               | Solution                   |
| ---------------------- | ------------------- | -------------------------- |
| Commands not appearing | Plugin not loaded   | Check config file path     |
| Plugin not found       | Wrong package name  | Use exact npm package name |
| Module not found       | Missing dist folder | Run `npm run build`        |
| Export error           | Wrong export format | Must use `export default`  |

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
   - `<mission_seal>SEALED</mission_seal>`
   - `All tasks completed`

### Stopping the Loop

- Type `/stop` or `/cancel`
- Wait for `<mission_seal>SEALED</mission_seal>`
- Maximum 1000 iterations (safety limit)

---

## Windows-Specific Issues (2026-01-16)

### Problem: Plugin Not Appearing After Installation on Windows

After running `npm install -g opencode-orchestrator`, the **Commander** agent doesn't appear in OpenCode's agent list, even though the installation completed successfully.

### Root Cause

On Windows, OpenCode may read configuration from **different paths** depending on the terminal environment:

| Environment                | Config Path                        |
| -------------------------- | ---------------------------------- |
| **PowerShell / CMD**       | `%APPDATA%\opencode\opencode.json` |
| **Git Bash / WSL / MSYS2** | `~/.config/opencode/opencode.json` |

The postinstall script was only writing to `%APPDATA%`, but if you're using Git Bash or WSL, OpenCode reads from `~/.config/opencode/`.

### Solution

**Option 1: Manual Fix (Immediate)**

Add the plugin to your config file manually:

```bash
# Check current config
cat ~/.config/opencode/opencode.json

# Add plugin (if missing)
# Edit the file and add "opencode-orchestrator" to the plugin array:
# { "plugin": ["opencode-orchestrator", ...] }
```

**Option 2: Reinstall (v0.5.10+)**

Version 0.5.10 and later automatically registers the plugin in **both** paths on Windows:

```bash
npm uninstall -g opencode-orchestrator
npm install -g opencode-orchestrator
```

### Verification

After fixing, verify both paths have the plugin registered:

```bash
# Check APPDATA path
cat "$APPDATA/opencode/opencode.json"

# Check ~/.config path
cat ~/.config/opencode/opencode.json

# Both should contain "opencode-orchestrator" in the plugin array
```

### Expected Output After Fix

```
🎯 OpenCode Orchestrator - Installing...
✅ Plugin registered: C:\Users\<username>\AppData\Roaming\opencode\opencode.json
✅ Plugin registered: C:\Users\<username>\.config\opencode\opencode.json

🚀 Ready! Restart OpenCode to use.
```

### After Applying Fix

1. **Close OpenCode completely** (including system tray)
2. **Restart OpenCode**
3. **Press Tab** to see the agent list
4. **Commander** should now appear in the list

---

## References

- [OpenCode Plugin API](https://opencode.ai/docs/plugins)
- [@opencode-ai/plugin package](https://www.npmjs.com/package/@opencode-ai/plugin)

---

**Last Updated**: 2026-01-16
