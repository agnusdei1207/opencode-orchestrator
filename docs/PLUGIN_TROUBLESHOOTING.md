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
   - Package name (e.g., `"oh-my-opencode"`) → looks in `node_modules`
   - Absolute path (e.g., `/path/to/plugin`)

3. **Plugin Entry Point**: Must export a **default function** that returns plugin hooks and tools.

---

## Key Findings from oh-my-opencode

### 1. Plugin Export Structure
```typescript
// src/index.ts
const OhMyOpenCodePlugin: Plugin = async (ctx) => {
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

export default OhMyOpenCodePlugin;
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

## Critical Fixes (2026-01-13)

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

## References

- [OpenCode Plugin API](https://opencode.ai/docs/plugins)
- [@opencode-ai/plugin package](https://www.npmjs.com/package/@opencode-ai/plugin)

---

**Last Updated**: 2026-01-13
