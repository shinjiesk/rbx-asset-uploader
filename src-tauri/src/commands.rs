use crate::api::types::AssetType;
use crate::codegen;
use crate::keystore;
use crate::lockfile::LockFile;
use crate::server::SharedServerState;
use crate::upload::FileEntry;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct CreatorProfile {
    pub id: String,
    pub name: String,
    pub creator_type: String,
    pub creator_id: String,
}

// --- API Key Commands ---

#[tauri::command]
pub fn save_api_key(key: String) -> Result<(), String> {
    keystore::save_api_key(&key)
}

#[tauri::command]
pub fn load_api_key() -> Result<Option<String>, String> {
    keystore::load_api_key()
}

#[tauri::command]
pub fn delete_api_key() -> Result<(), String> {
    keystore::delete_api_key()
}

#[tauri::command]
pub fn has_api_key() -> Result<bool, String> {
    keystore::has_api_key()
}

// --- File Scanning ---

#[tauri::command]
pub fn scan_files(paths: Vec<String>, lock_file_path: Option<String>) -> Result<Vec<FileEntry>, String> {
    let lockfile = if let Some(lf_path) = lock_file_path {
        LockFile::load(&PathBuf::from(lf_path))?
    } else {
        LockFile::default()
    };

    let mut entries = Vec::new();
    for path_str in &paths {
        let path = PathBuf::from(path_str);
        if path.is_dir() {
            scan_directory(&path, &lockfile, &mut entries)?;
        } else if path.is_file() {
            if let Some(entry) = create_file_entry(&path, &lockfile) {
                entries.push(entry);
            }
        }
    }
    Ok(entries)
}

fn scan_directory(dir: &PathBuf, lockfile: &LockFile, entries: &mut Vec<FileEntry>) -> Result<(), String> {
    let read_dir = std::fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory: {e}"))?;

    for entry in read_dir {
        let entry = entry.map_err(|e| format!("Failed to read entry: {e}"))?;
        let path = entry.path();
        if path.is_dir() {
            scan_directory(&path, lockfile, entries)?;
        } else if path.is_file() {
            if let Some(file_entry) = create_file_entry(&path, lockfile) {
                entries.push(file_entry);
            }
        }
    }
    Ok(())
}

fn create_file_entry(path: &PathBuf, lockfile: &LockFile) -> Option<FileEntry> {
    let extension = path.extension()?.to_str()?;
    let asset_type = AssetType::from_extension(extension)?;
    let filename = path.file_name()?.to_str()?.to_string();
    let metadata = std::fs::metadata(path).ok()?;
    let category = asset_type.category_name().to_string();
    let existing_asset_id = lockfile.get_asset_id(&category, &filename);

    Some(FileEntry {
        path: path.to_string_lossy().to_string(),
        filename,
        size: metadata.len(),
        asset_type: asset_type.api_name().to_string(),
        category,
        existing_asset_id,
        excluded: false,
        status: crate::upload::UploadStatus::Pending,
    })
}

// --- Upload ---

#[tauri::command]
pub async fn upload_files(
    entries: Vec<FileEntry>,
    api_key: String,
    creator_type: String,
    creator_id: String,
    project_path: String,
) -> Result<Vec<crate::upload::UploadResult>, String> {
    let results = crate::upload::upload_files(
        entries,
        &api_key,
        &creator_type,
        &creator_id,
        &project_path,
    )
    .await;
    Ok(results)
}

// --- Lock File & Codegen ---

#[tauri::command]
pub fn load_lock_file(project_path: String) -> Result<LockFile, String> {
    let path = PathBuf::from(&project_path).join("assets.lock.toml");
    LockFile::load(&path)
}

#[tauri::command]
pub fn generate_assets_lua(project_path: String, output_path: Option<String>) -> Result<String, String> {
    let lock_path = PathBuf::from(&project_path).join("assets.lock.toml");
    let lockfile = LockFile::load(&lock_path)?;
    let lua_content = codegen::generate_assets_lua(&lockfile);

    let out = if let Some(op) = output_path {
        PathBuf::from(op)
    } else {
        PathBuf::from(&project_path).join("Assets.lua")
    };

    std::fs::write(&out, &lua_content)
        .map_err(|e| format!("Failed to write Assets.lua: {e}"))?;

    Ok(lua_content)
}

// --- Studio Sessions ---

#[tauri::command]
pub async fn get_studio_sessions(
    state: State<'_, SharedServerState>,
) -> Result<Vec<crate::server::StudioSession>, String> {
    let state = state.lock().await;
    Ok(state.sessions.values().cloned().collect())
}

#[tauri::command]
pub async fn push_to_studio(
    session_id: String,
    instance_path: String,
    source: String,
    state: State<'_, SharedServerState>,
) -> Result<(), String> {
    let mut state = state.lock().await;
    let queue = state
        .command_queues
        .entry(session_id.clone())
        .or_default();
    queue.push(crate::server::StudioCommand {
        command_type: "set_script".to_string(),
        instance_path,
        source,
    });
    Ok(())
}
