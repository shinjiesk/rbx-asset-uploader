use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AssetType {
    Decal,
    Audio,
    Model,
}

impl AssetType {
    pub fn from_extension(ext: &str) -> Option<Self> {
        match ext.to_lowercase().as_str() {
            "png" | "jpeg" | "jpg" => Some(Self::Decal),
            "mp3" | "ogg" | "flac" | "wav" => Some(Self::Audio),
            "fbx" => Some(Self::Model),
            _ => None,
        }
    }

    pub fn category_name(&self) -> &'static str {
        match self {
            Self::Decal => "Image",
            Self::Audio => "Audio",
            Self::Model => "Model",
        }
    }

    pub fn api_name(&self) -> &'static str {
        match self {
            Self::Decal => "Decal",
            Self::Audio => "Audio",
            Self::Model => "Model",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAssetRequest {
    pub asset_type: String,
    pub display_name: String,
    pub description: String,
    pub creation_context: CreationContext,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreationContext {
    pub creator: Creator,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Creator {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub group_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationResponse {
    pub path: Option<String>,
    pub done: Option<bool>,
    pub response: Option<OperationResult>,
    pub error: Option<OperationError>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationResult {
    pub asset_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationError {
    pub code: Option<i32>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAssetRequest {
    pub asset_type: String,
    pub display_name: Option<String>,
    pub description: Option<String>,
}
