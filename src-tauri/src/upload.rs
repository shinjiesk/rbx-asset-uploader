use crate::api::client::RobloxApiClient;
use crate::codegen;
use crate::lockfile::LockFile;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Semaphore;

const MAX_CONCURRENT_UPLOADS: usize = 3;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum UploadStatus {
    Pending,
    Uploading,
    Processing,
    Success { asset_id: u64 },
    Failed { error: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub path: String,
    pub filename: String,
    pub size: u64,
    pub asset_type: String,
    pub category: String,
    pub existing_asset_id: Option<u64>,
    pub excluded: bool,
    pub status: UploadStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadResult {
    pub path: String,
    pub filename: String,
    pub status: UploadStatus,
}

pub async fn upload_files(
    entries: Vec<FileEntry>,
    api_key: &str,
    creator_type: &str,
    creator_id: &str,
    project_path: &str,
) -> Vec<UploadResult> {
    let client = Arc::new(RobloxApiClient::new(api_key.to_string()));
    let semaphore = Arc::new(Semaphore::new(MAX_CONCURRENT_UPLOADS));
    let lock_path = PathBuf::from(project_path).join("assets.lock.toml");
    let lockfile = Arc::new(tokio::sync::Mutex::new(
        LockFile::load(&lock_path).unwrap_or_default(),
    ));

    let mut handles = Vec::new();

    for entry in entries {
        let client = client.clone();
        let sem = semaphore.clone();
        let lockfile = lockfile.clone();
        let lock_path = lock_path.clone();
        let creator_type = creator_type.to_string();
        let creator_id = creator_id.to_string();

        let handle = tokio::spawn(async move {
            let _permit = sem.acquire().await.unwrap();

            let file_path = PathBuf::from(&entry.path);
            let display_name = file_path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or(&entry.filename)
                .to_string();

            let result = if let Some(asset_id) = entry.existing_asset_id {
                client
                    .update_asset(asset_id, &file_path, &entry.asset_type)
                    .await
            } else {
                client
                    .create_asset(
                        &file_path,
                        &entry.asset_type,
                        &display_name,
                        &creator_type,
                        &creator_id,
                    )
                    .await
            };

            let status = match result {
                Ok(asset_id) => {
                    let mut lf = lockfile.lock().await;
                    lf.set_asset_id(&entry.category, entry.filename.clone(), asset_id);
                    if let Err(e) = lf.save(&lock_path) {
                        eprintln!("Failed to save lock file: {e}");
                    }
                    UploadStatus::Success { asset_id }
                }
                Err(e) => UploadStatus::Failed {
                    error: e.to_string(),
                },
            };

            UploadResult {
                path: entry.path,
                filename: entry.filename,
                status,
            }
        });

        handles.push(handle);
    }

    let mut results = Vec::new();
    for handle in handles {
        match handle.await {
            Ok(result) => results.push(result),
            Err(e) => {
                results.push(UploadResult {
                    path: String::new(),
                    filename: String::new(),
                    status: UploadStatus::Failed {
                        error: format!("Task panicked: {e}"),
                    },
                });
            }
        }
    }

    // Regenerate Assets.lua
    let lf = lockfile.lock().await;
    let lua_path = PathBuf::from(project_path).join("Assets.lua");
    if let Err(e) = codegen::save_assets_lua(&lf, &lua_path) {
        eprintln!("Failed to generate Assets.lua: {e}");
    }

    results
}
