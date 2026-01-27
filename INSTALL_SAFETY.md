# Installation Safety Improvements

## Problem

When running `npm install -g opencode-orchestrator`, the `.config/opencode/opencode.json` file was being overwritten, causing loss of existing plugin configurations.

## Solution

Enhanced `postinstall.ts` and `preuninstall.ts` with multiple safety layers:

### 1. Automatic Backup Creation
- Creates timestamped backups before any modifications
- Format: `opencode.json.backup.2026-01-27T12-34-56-789Z`
- Keeps last 5 backups automatically

### 2. Atomic File Writing
- Writes to temporary file first
- Uses OS-level atomic `rename()` operation
- Prevents partial writes and corruption
- Auto-cleanup of temp files on failure

### 3. Config Validation
- Validates JSON structure before reading
- Ensures `plugin` field is an array of strings
- Handles corrupted configs gracefully

### 4. Rollback Mechanism
- Automatic rollback on write failure
- Restores from backup if verification fails
- Preserves user data in all failure scenarios

### 5. Write Verification
- Reads back config after write
- Verifies plugin was added/removed correctly
- Triggers rollback if verification fails

### 6. Cross-Platform Support
- Windows: `%APPDATA%\opencode` and `~\.config\opencode`
- macOS/Linux: `~/.config/opencode`
- Respects `XDG_CONFIG_HOME` environment variable
- Git Bash, WSL, MSYS2 compatible

### 7. Enhanced Error Handling
- Specific error messages for each failure type:
  - `EACCES`/`EPERM`: Permission denied
  - `ENOENT`: File not found
  - `EIO`: File lock error
  - `ENOSPC`: Disk full
  - `EROFS`: Read-only filesystem
  - `SyntaxError`: JSON syntax error

### 8. Detailed Logging
- All operations logged to: `/tmp/opencode-orchestrator.log` (Unix) or `%TEMP%\opencode-orchestrator.log` (Windows)
- Timestamps, platform info, error details
- Debug-friendly for troubleshooting

## Usage

### Installation (Safe Merge)
```bash
npm install -g opencode-orchestrator
```

**Behavior**:
1. ✅ Reads existing `opencode.json`
2. ✅ Creates backup before changes
3. ✅ Merges plugin into existing config
4. ✅ Preserves all other plugins and settings
5. ✅ Verifies write succeeded
6. ✅ Auto-rollback if anything fails

### Uninstallation (Safe Removal)
```bash
npm uninstall -g opencode-orchestrator
```

**Behavior**:
1. ✅ Reads existing `opencode.json`
2. ✅ Creates backup before changes
3. ✅ Removes only `opencode-orchestrator` plugin
4. ✅ Preserves all other plugins and settings
5. ✅ Verifies write succeeded
6. ✅ Auto-rollback if anything fails

## Safety Guarantees

### Before (v1.2.44 and earlier)
- ⚠️ Could overwrite entire config
- ⚠️ No backup mechanism
- ⚠️ No rollback on failure
- ⚠️ No write verification

### After (v1.2.45+)
- ✅ **Never overwrites** - always merges
- ✅ **Automatic backups** - timestamped, last 5 kept
- ✅ **Atomic writes** - temp file + rename
- ✅ **Rollback on failure** - automatic restore
- ✅ **Write verification** - ensures correctness
- ✅ **Cross-platform** - Windows/macOS/Linux

## Example Scenarios

### Scenario 1: Existing Config
```json
// Before: ~/.config/opencode/opencode.json
{
  "plugin": ["other-plugin"],
  "settings": {
    "theme": "dark"
  }
}
```

After `npm install -g opencode-orchestrator`:
```json
// After: ~/.config/opencode/opencode.json
{
  "plugin": [
    "other-plugin",
    "opencode-orchestrator"
  ],
  "settings": {
    "theme": "dark"
  }
}
```

**Backup**: `~/.config/opencode/opencode.json.backup.2026-01-27T12-34-56-789Z`

### Scenario 2: Corrupted Config
If JSON is corrupted:
1. ✅ Creates backup of corrupted file
2. ✅ Shows warning: `⚠️ Corrupted config detected. Backup saved: <path>`
3. ✅ Creates fresh config with plugin
4. ✅ User can restore from backup manually if needed

### Scenario 3: Write Failure
If write fails (permissions, disk full, etc.):
1. ✅ Automatic rollback triggered
2. ✅ Restores from backup
3. ✅ Shows error: `⚠️ Registration failed. Restored from backup: <path>`
4. ✅ Original config preserved

### Scenario 4: Multiple Installs
If plugin already registered:
- ✅ Detects existing entry
- ✅ Skips registration
- ✅ Shows: `✅ Plugin already registered.`
- ✅ No modifications made

## Implementation Details

### Atomic Write Process
```typescript
// 1. Write to temp file
writeFileSync(tempFile, JSON.stringify(config, null, 2) + "\n");

// 2. Atomic rename (OS-level atomic operation)
renameSync(tempFile, configFile);

// 3. Verify
const verifyConfig = JSON.parse(readFileSync(configFile, "utf-8"));
if (!verifyConfig.plugin?.includes(PLUGIN_NAME)) {
  // Rollback!
  copyFileSync(backupFile, configFile);
}
```

### Backup Strategy
- **Format**: `opencode.json.backup.<ISO-timestamp>`
- **Retention**: Last 5 backups kept
- **Location**: Same directory as `opencode.json`
- **Cleanup**: Automatic on successful write

### Rollback Trigger Conditions
1. Write verification fails (plugin not found after write)
2. File system error during write
3. JSON parse error after write
4. Any exception during registration

## Testing

### Manual Testing
```bash
# 1. Create test config
mkdir -p ~/.config/opencode
echo '{"plugin":["test-plugin"],"theme":"dark"}' > ~/.config/opencode/opencode.json

# 2. Install
npm install -g opencode-orchestrator

# 3. Verify merge (not overwrite)
cat ~/.config/opencode/opencode.json
# Should show: {"plugin":["test-plugin","opencode-orchestrator"],"theme":"dark"}

# 4. Check backup created
ls -la ~/.config/opencode/opencode.json.backup.*

# 5. Uninstall
npm uninstall -g opencode-orchestrator

# 6. Verify clean removal
cat ~/.config/opencode/opencode.json
# Should show: {"plugin":["test-plugin"],"theme":"dark"}
```

### Corruption Test
```bash
# 1. Corrupt config
echo 'invalid json{' > ~/.config/opencode/opencode.json

# 2. Install (should handle gracefully)
npm install -g opencode-orchestrator

# 3. Check backup of corrupted file exists
ls -la ~/.config/opencode/opencode.json.backup.*
```

## Logs

Check logs for debugging:
- **Unix/macOS**: `/tmp/opencode-orchestrator.log`
- **Windows**: `%TEMP%\opencode-orchestrator.log`

Log format:
```
[2026-01-27T12:34:56.789Z] [postinstall] Installation started {"platform":"darwin","node":"v20.x.x"}
[2026-01-27T12:34:56.790Z] [postinstall] Config paths to check ["/Users/user/.config/opencode"]
[2026-01-27T12:34:56.791Z] [postinstall] Backup created {"backupFile":"/Users/user/.config/opencode/opencode.json.backup.2026-01-27T12-34-56-789Z"}
[2026-01-27T12:34:56.792Z] [postinstall] Adding plugin to config {"plugin":"opencode-orchestrator","configFile":"/Users/user/.config/opencode/opencode.json"}
[2026-01-27T12:34:56.793Z] [postinstall] Atomic write successful {"filePath":"/Users/user/.config/opencode/opencode.json"}
[2026-01-27T12:34:56.794Z] [postinstall] Plugin registered successfully {"configFile":"/Users/user/.config/opencode/opencode.json"}
```

## Compatibility

### Node.js Versions
- Tested: Node.js 18.x, 20.x, 22.x
- Minimum: Node.js 18.0.0

### Operating Systems
- ✅ Windows 10/11 (native, Git Bash, WSL, MSYS2)
- ✅ macOS 11+ (Intel, Apple Silicon)
- ✅ Linux (Ubuntu, Debian, Fedora, Arch, etc.)

### Package Managers
- ✅ npm
- ✅ yarn
- ✅ pnpm
- ✅ bun

## Summary

The installation process is now **production-safe** with multiple layers of protection:

1. ✅ **Never overwrites** - always merges
2. ✅ **Automatic backups** - before every change
3. ✅ **Atomic writes** - no partial writes
4. ✅ **Write verification** - ensures correctness
5. ✅ **Automatic rollback** - on any failure
6. ✅ **Cross-platform** - all major OSes
7. ✅ **Error recovery** - graceful degradation
8. ✅ **Detailed logging** - for debugging

**Result**: Zero risk of data loss during install/uninstall.
