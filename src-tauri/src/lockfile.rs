use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LockFile {
    pub assets: AssetEntries,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "PascalCase")]
pub struct AssetEntries {
    #[serde(default)]
    pub image: BTreeMap<String, u64>,
    #[serde(default)]
    pub audio: BTreeMap<String, u64>,
    #[serde(default)]
    pub model: BTreeMap<String, u64>,
}

impl LockFile {
    pub fn load(path: &Path) -> Result<Self, String> {
        if !path.exists() {
            return Ok(Self::default());
        }
        let content =
            std::fs::read_to_string(path).map_err(|e| format!("Failed to read lock file: {e}"))?;
        toml::from_str(&content).map_err(|e| format!("Failed to parse lock file: {e}"))
    }

    pub fn save(&self, path: &Path) -> Result<(), String> {
        let content =
            toml::to_string_pretty(self).map_err(|e| format!("Failed to serialize lock file: {e}"))?;
        std::fs::write(path, content).map_err(|e| format!("Failed to write lock file: {e}"))
    }

    pub fn get_asset_id(&self, category: &str, filename: &str) -> Option<u64> {
        match category {
            "Image" => self.assets.image.get(filename).copied(),
            "Audio" => self.assets.audio.get(filename).copied(),
            "Model" => self.assets.model.get(filename).copied(),
            _ => None,
        }
    }

    pub fn set_asset_id(&mut self, category: &str, filename: String, asset_id: u64) {
        let map = match category {
            "Image" => &mut self.assets.image,
            "Audio" => &mut self.assets.audio,
            "Model" => &mut self.assets.model,
            _ => return,
        };
        map.insert(filename, asset_id);
    }
}
