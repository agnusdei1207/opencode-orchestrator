use anyhow::{Context, Result, anyhow, bail};
use serde_json::{Value, json};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const PLUGIN_NAME: &str = "opencode-orchestrator";
const JSONC_FILE: &str = "opencode.jsonc";
const JSON_FILE: &str = "opencode.json";

pub fn install() -> Result<()> {
    let config_path = get_opencode_config_path()?;
    let mut config = read_config(&config_path)?;

    if !register_plugin(&mut config)? {
        println!("Plugin is already registered in {}", config_path.display());
        return Ok(());
    }

    let backup = write_config(&config_path, &config)?;
    println!("Plugin registered in {}", config_path.display());
    if let Some(path) = backup {
        println!("Backup created at {}", path.display());
    }
    println!("Restart OpenCode to use the plugin.");
    Ok(())
}

pub fn uninstall() -> Result<()> {
    let config_path = get_opencode_config_path()?;
    if !config_path.exists() {
        println!("Config not found at {}", config_path.display());
        return Ok(());
    }

    let mut config = read_config(&config_path)?;
    if !unregister_plugin(&mut config)? {
        println!("Plugin is not registered in {}", config_path.display());
        return Ok(());
    }

    let backup = write_config(&config_path, &config)?;
    println!("Plugin removed from {}", config_path.display());
    if let Some(path) = backup {
        println!("Backup created at {}", path.display());
    }
    Ok(())
}

fn get_opencode_config_path() -> Result<PathBuf> {
    resolve_config_path(
        non_empty_env("OPENCODE_CONFIG_DIR"),
        non_empty_env("XDG_CONFIG_HOME"),
        non_empty_env("HOME"),
        non_empty_env("USERPROFILE"),
    )
}

fn non_empty_env(name: &str) -> Option<String> {
    env::var(name).ok().filter(|value| !value.trim().is_empty())
}

fn resolve_config_path(
    explicit_dir: Option<String>,
    xdg_dir: Option<String>,
    home_dir: Option<String>,
    user_profile: Option<String>,
) -> Result<PathBuf> {
    let config_dir = explicit_dir
        .map(PathBuf::from)
        .or_else(|| xdg_dir.map(|path| PathBuf::from(path).join("opencode")))
        .or_else(|| {
            home_dir
                .or(user_profile)
                .map(|path| PathBuf::from(path).join(".config").join("opencode"))
        })
        .ok_or_else(|| {
            anyhow!(
                "Could not determine OpenCode config path; set OPENCODE_CONFIG_DIR, XDG_CONFIG_HOME, HOME, or USERPROFILE"
            )
        })?;

    Ok(resolve_config_file(&config_dir))
}

fn resolve_config_file(config_dir: &Path) -> PathBuf {
    let jsonc = config_dir.join(JSONC_FILE);
    if jsonc.exists() {
        return jsonc;
    }
    let json = config_dir.join(JSON_FILE);
    if json.exists() {
        return json;
    }
    jsonc
}

fn read_config(path: &Path) -> Result<Value> {
    if !path.exists() {
        return Ok(json!({}));
    }

    let content = fs::read_to_string(path)
        .with_context(|| format!("Could not read OpenCode config {}", path.display()))?;
    if content.trim().is_empty() {
        return Ok(json!({}));
    }

    let config: Value = serde_json::from_str(&content).with_context(|| {
        format!(
            "OpenCode config {} is not strict JSON and was left unchanged; use the npm install hook for JSONC files",
            path.display()
        )
    })?;
    if !config.is_object() {
        bail!(
            "OpenCode config {} must contain a JSON object",
            path.display()
        );
    }
    Ok(config)
}

fn register_plugin(config: &mut Value) -> Result<bool> {
    let object = config
        .as_object_mut()
        .context("OpenCode config must be an object")?;
    let plugins = object.entry("plugin").or_insert_with(|| json!([]));
    let entries = validated_plugin_entries(plugins)?;
    if entries.iter().any(is_our_plugin_entry) {
        return Ok(false);
    }
    entries.push(json!(PLUGIN_NAME));
    Ok(true)
}

fn unregister_plugin(config: &mut Value) -> Result<bool> {
    let object = config
        .as_object_mut()
        .context("OpenCode config must be an object")?;
    let Some(plugins) = object.get_mut("plugin") else {
        return Ok(false);
    };
    let entries = validated_plugin_entries(plugins)?;
    let original_len = entries.len();
    entries.retain(|entry| !is_our_plugin_entry(entry));
    Ok(entries.len() != original_len)
}

fn validated_plugin_entries(value: &mut Value) -> Result<&mut Vec<Value>> {
    let entries = value
        .as_array_mut()
        .context("OpenCode config field `plugin` must be an array")?;
    if entries
        .iter()
        .any(|entry| plugin_entry_name(entry).is_none())
    {
        bail!("OpenCode config field `plugin` contains an invalid entry");
    }
    Ok(entries)
}

fn plugin_entry_name(entry: &Value) -> Option<&str> {
    if let Some(name) = entry.as_str() {
        return Some(name);
    }
    let tuple = entry.as_array()?;
    if tuple.len() != 2 || !tuple[1].is_object() {
        return None;
    }
    tuple[0].as_str()
}

fn is_our_plugin_entry(entry: &Value) -> bool {
    plugin_entry_name(entry)
        .is_some_and(|name| name == PLUGIN_NAME || name.starts_with(&format!("{PLUGIN_NAME}@")))
}

fn write_config(path: &Path, config: &Value) -> Result<Option<PathBuf>> {
    let parent = path
        .parent()
        .ok_or_else(|| anyhow!("Config path {} has no parent directory", path.display()))?;
    fs::create_dir_all(parent).with_context(|| {
        format!(
            "Could not create OpenCode config directory {}",
            parent.display()
        )
    })?;

    let original = if path.exists() {
        Some(fs::read(path).with_context(|| format!("Could not back up {}", path.display()))?)
    } else {
        None
    };
    let backup = original
        .as_ref()
        .map(|content| create_backup(path, content))
        .transpose()?;
    let serialized = format!("{}\n", serde_json::to_string_pretty(config)?);

    let result = fs::write(path, serialized)
        .with_context(|| format!("Could not write OpenCode config {}", path.display()))
        .and_then(|()| verify_written_config(path, config));
    if let Err(error) = result {
        restore_original(path, original.as_deref()).with_context(|| {
            format!(
                "Write failed and rollback also failed for {}",
                path.display()
            )
        })?;
        return Err(error);
    }
    Ok(backup)
}

fn create_backup(path: &Path, content: &[u8]) -> Result<PathBuf> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .context("System clock is before the Unix epoch")?
        .as_millis();
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .context("Config file name is not valid UTF-8")?;
    let backup = path.with_file_name(format!("{file_name}.backup.{timestamp}"));
    fs::write(&backup, content)
        .with_context(|| format!("Could not create backup {}", backup.display()))?;
    Ok(backup)
}

fn verify_written_config(path: &Path, expected: &Value) -> Result<()> {
    let actual = read_config(path)?;
    if actual != *expected {
        bail!("OpenCode config verification failed for {}", path.display());
    }
    Ok(())
}

fn restore_original(path: &Path, original: Option<&[u8]>) -> Result<()> {
    match original {
        Some(content) => fs::write(path, content)
            .with_context(|| format!("Could not restore OpenCode config {}", path.display())),
        None if path.exists() => fs::remove_file(path)
            .with_context(|| format!("Could not remove incomplete config {}", path.display())),
        None => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process;

    struct TestDir(PathBuf);

    impl TestDir {
        fn new(name: &str) -> Self {
            let nonce = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            let path = env::temp_dir().join(format!("oco-config-{name}-{}-{nonce}", process::id()));
            fs::create_dir_all(&path).unwrap();
            Self(path)
        }
    }

    impl Drop for TestDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn config_path_matches_opencode_precedence() {
        let explicit = resolve_config_path(
            Some("custom".into()),
            Some("xdg".into()),
            Some("home".into()),
            Some("profile".into()),
        )
        .unwrap();
        assert_eq!(explicit, PathBuf::from("custom").join(JSONC_FILE));

        let xdg = resolve_config_path(None, Some("xdg".into()), Some("home".into()), None).unwrap();
        assert_eq!(xdg, PathBuf::from("xdg").join("opencode").join(JSONC_FILE));

        let home =
            resolve_config_path(None, None, Some("home".into()), Some("profile".into())).unwrap();
        assert_eq!(
            home,
            PathBuf::from("home")
                .join(".config")
                .join("opencode")
                .join(JSONC_FILE)
        );
    }

    #[test]
    fn config_file_prefers_existing_jsonc_then_json() {
        let dir = TestDir::new("file-precedence");
        let json = dir.0.join(JSON_FILE);
        fs::write(&json, "{}").unwrap();
        assert_eq!(resolve_config_file(&dir.0), json);

        let jsonc = dir.0.join(JSONC_FILE);
        fs::write(&jsonc, "{}").unwrap();
        assert_eq!(resolve_config_file(&dir.0), jsonc);
    }

    #[test]
    fn corrupt_config_is_rejected_without_modification() {
        let dir = TestDir::new("corrupt");
        let path = dir.0.join(JSONC_FILE);
        let content = "{ invalid json |||";
        fs::write(&path, content).unwrap();

        assert!(read_config(&path).is_err());
        assert_eq!(fs::read_to_string(path).unwrap(), content);
    }

    #[test]
    fn registration_recognizes_versioned_and_tuple_entries() {
        let mut versioned = json!({ "plugin": ["opencode-orchestrator@1.7.19"] });
        assert!(!register_plugin(&mut versioned).unwrap());

        let mut tuple = json!({
            "plugin": [["opencode-orchestrator", { "missionLoop": { "ledger": true } }]]
        });
        assert!(!register_plugin(&mut tuple).unwrap());
    }

    #[test]
    fn uninstall_removes_only_our_entries() {
        let mut config = json!({
            "plugin": [
                "other-plugin",
                "opencode-orchestrator@1.7.19",
                ["opencode-orchestrator", { "missionLoop": { "ledger": true } }]
            ],
            "mcp": { "orchestrator": { "command": "user-owned" } }
        });

        assert!(unregister_plugin(&mut config).unwrap());
        assert_eq!(config["plugin"], json!(["other-plugin"]));
        assert_eq!(config["mcp"]["orchestrator"]["command"], "user-owned");
    }

    #[test]
    fn writes_verified_config_and_preserves_a_backup() {
        let dir = TestDir::new("write");
        let path = dir.0.join(JSON_FILE);
        let original = json!({ "plugin": ["other-plugin"] });
        fs::write(&path, serde_json::to_vec(&original).unwrap()).unwrap();
        let updated = json!({ "plugin": ["other-plugin", PLUGIN_NAME] });

        let backup = write_config(&path, &updated).unwrap().unwrap();
        assert_eq!(read_config(&path).unwrap(), updated);
        assert_eq!(
            serde_json::from_slice::<Value>(&fs::read(backup).unwrap()).unwrap(),
            original
        );
    }

    #[test]
    fn invalid_plugin_shape_is_rejected() {
        let mut config = json!({ "plugin": "opencode-orchestrator" });
        assert!(register_plugin(&mut config).is_err());
        assert_eq!(config["plugin"], "opencode-orchestrator");
    }
}
