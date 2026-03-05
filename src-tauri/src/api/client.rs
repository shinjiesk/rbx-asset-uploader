use super::types::*;
use reqwest::multipart::{Form, Part};
use reqwest::{Client, StatusCode};
use std::path::Path;
use std::time::Duration;

const BASE_URL: &str = "https://apis.roblox.com/assets/v1";
const MAX_RETRIES: u32 = 3;
const OPERATION_POLL_INTERVAL: Duration = Duration::from_secs(2);
const OPERATION_MAX_POLLS: u32 = 30;

pub struct RobloxApiClient {
    client: Client,
    api_key: String,
}

#[derive(Debug)]
pub enum ApiError {
    Validation(String),
    Auth(String),
    RateLimit { retry_after: Option<u64> },
    Server(String),
    Network(String),
    OperationTimeout,
    OperationFailed(String),
}

impl std::fmt::Display for ApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Validation(msg) => write!(f, "Validation error: {msg}"),
            Self::Auth(msg) => write!(f, "Auth error: {msg}"),
            Self::RateLimit { .. } => write!(f, "Rate limited"),
            Self::Server(msg) => write!(f, "Server error: {msg}"),
            Self::Network(msg) => write!(f, "Network error: {msg}"),
            Self::OperationTimeout => write!(f, "Operation timed out"),
            Self::OperationFailed(msg) => write!(f, "Operation failed: {msg}"),
        }
    }
}

impl ApiError {
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            Self::RateLimit { .. } | Self::Server(_) | Self::Network(_)
        )
    }
}

fn classify_error(status: StatusCode, body: &str) -> ApiError {
    match status.as_u16() {
        400 => ApiError::Validation(body.to_string()),
        401 | 403 => ApiError::Auth(body.to_string()),
        429 => ApiError::RateLimit { retry_after: None },
        500..=599 => ApiError::Server(body.to_string()),
        _ => ApiError::Server(format!("{status}: {body}")),
    }
}

impl RobloxApiClient {
    pub fn new(api_key: String) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(120))
            .build()
            .expect("Failed to create HTTP client");
        Self { client, api_key }
    }

    pub async fn create_asset(
        &self,
        file_path: &Path,
        asset_type: &str,
        display_name: &str,
        creator_type: &str,
        creator_id: &str,
    ) -> Result<u64, ApiError> {
        let creator = match creator_type {
            "user" => Creator {
                user_id: Some(creator_id.to_string()),
                group_id: None,
            },
            _ => Creator {
                user_id: None,
                group_id: Some(creator_id.to_string()),
            },
        };

        let request_json = serde_json::to_string(&CreateAssetRequest {
            asset_type: asset_type.to_string(),
            display_name: display_name.to_string(),
            description: String::new(),
            creation_context: CreationContext { creator },
        })
        .map_err(|e| ApiError::Validation(e.to_string()))?;

        let file_bytes = tokio::fs::read(file_path)
            .await
            .map_err(|e| ApiError::Validation(format!("Cannot read file: {e}")))?;

        let file_name = file_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("file")
            .to_string();

        let operation_path = self
            .execute_with_retry(|| {
                let request_json = request_json.clone();
                let file_bytes = file_bytes.clone();
                let file_name = file_name.clone();
                async move {
                    let form = Form::new()
                        .part(
                            "request",
                            Part::text(request_json).mime_str("application/json").unwrap(),
                        )
                        .part(
                            "fileContent",
                            Part::bytes(file_bytes)
                                .file_name(file_name)
                                .mime_str("application/octet-stream")
                                .unwrap(),
                        );

                    let resp = self
                        .client
                        .post(format!("{BASE_URL}/assets"))
                        .header("x-api-key", &self.api_key)
                        .multipart(form)
                        .send()
                        .await
                        .map_err(|e| ApiError::Network(e.to_string()))?;

                    let status = resp.status();
                    if !status.is_success() {
                        let body = resp.text().await.unwrap_or_default();
                        let mut err = classify_error(status, &body);
                        if let ApiError::RateLimit { retry_after } = &mut err {
                            // Would parse Retry-After header here but we already consumed resp
                            *retry_after = None;
                        }
                        return Err(err);
                    }

                    let op: OperationResponse = resp
                        .json()
                        .await
                        .map_err(|e| ApiError::Server(format!("Invalid response: {e}")))?;

                    op.path
                        .ok_or_else(|| ApiError::Server("No operation path in response".to_string()))
                }
            })
            .await?;

        self.poll_operation(&operation_path).await
    }

    pub async fn update_asset(
        &self,
        asset_id: u64,
        file_path: &Path,
        asset_type: &str,
    ) -> Result<u64, ApiError> {
        let request_json = serde_json::to_string(&UpdateAssetRequest {
            asset_type: asset_type.to_string(),
            display_name: None,
            description: None,
        })
        .map_err(|e| ApiError::Validation(e.to_string()))?;

        let file_bytes = tokio::fs::read(file_path)
            .await
            .map_err(|e| ApiError::Validation(format!("Cannot read file: {e}")))?;

        let file_name = file_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("file")
            .to_string();

        let operation_path = self
            .execute_with_retry(|| {
                let request_json = request_json.clone();
                let file_bytes = file_bytes.clone();
                let file_name = file_name.clone();
                async move {
                    let form = Form::new()
                        .part(
                            "request",
                            Part::text(request_json).mime_str("application/json").unwrap(),
                        )
                        .part(
                            "fileContent",
                            Part::bytes(file_bytes)
                                .file_name(file_name)
                                .mime_str("application/octet-stream")
                                .unwrap(),
                        );

                    let resp = self
                        .client
                        .patch(format!("{BASE_URL}/assets/{asset_id}"))
                        .header("x-api-key", &self.api_key)
                        .multipart(form)
                        .send()
                        .await
                        .map_err(|e| ApiError::Network(e.to_string()))?;

                    let status = resp.status();
                    if !status.is_success() {
                        let body = resp.text().await.unwrap_or_default();
                        return Err(classify_error(status, &body));
                    }

                    let op: OperationResponse = resp
                        .json()
                        .await
                        .map_err(|e| ApiError::Server(format!("Invalid response: {e}")))?;

                    op.path
                        .ok_or_else(|| ApiError::Server("No operation path in response".to_string()))
                }
            })
            .await?;

        self.poll_operation(&operation_path).await
    }

    async fn poll_operation(&self, operation_path: &str) -> Result<u64, ApiError> {
        let operation_id = operation_path
            .rsplit('/')
            .next()
            .unwrap_or(operation_path);

        for _ in 0..OPERATION_MAX_POLLS {
            tokio::time::sleep(OPERATION_POLL_INTERVAL).await;

            let resp = self
                .client
                .get(format!("{BASE_URL}/operations/{operation_id}"))
                .header("x-api-key", &self.api_key)
                .send()
                .await
                .map_err(|e| ApiError::Network(e.to_string()))?;

            let status = resp.status();
            if !status.is_success() {
                let body = resp.text().await.unwrap_or_default();
                let err = classify_error(status, &body);
                if err.is_retryable() {
                    continue;
                }
                return Err(err);
            }

            let op: OperationResponse = resp
                .json()
                .await
                .map_err(|e| ApiError::Server(format!("Invalid poll response: {e}")))?;

            if let Some(error) = op.error {
                return Err(ApiError::OperationFailed(
                    error.message.unwrap_or_else(|| "Unknown error".to_string()),
                ));
            }

            if op.done == Some(true) {
                if let Some(result) = op.response {
                    if let Some(id_str) = result.asset_id {
                        let asset_id: u64 = id_str
                            .parse()
                            .map_err(|_| ApiError::Server(format!("Invalid asset ID: {id_str}")))?;
                        return Ok(asset_id);
                    }
                }
                return Err(ApiError::Server("Operation done but no asset ID".to_string()));
            }
        }

        Err(ApiError::OperationTimeout)
    }

    async fn execute_with_retry<F, Fut, T>(&self, mut f: F) -> Result<T, ApiError>
    where
        F: FnMut() -> Fut,
        Fut: std::future::Future<Output = Result<T, ApiError>>,
    {
        let mut last_error = None;
        let backoff_secs = [1, 2, 4];

        for attempt in 0..=MAX_RETRIES {
            match f().await {
                Ok(val) => return Ok(val),
                Err(e) => {
                    if !e.is_retryable() || attempt == MAX_RETRIES {
                        return Err(e);
                    }
                    if let ApiError::RateLimit {
                        retry_after: Some(secs),
                    } = &e
                    {
                        tokio::time::sleep(Duration::from_secs(*secs)).await;
                    } else {
                        let delay = backoff_secs.get(attempt as usize).copied().unwrap_or(4);
                        tokio::time::sleep(Duration::from_secs(delay)).await;
                    }
                    last_error = Some(e);
                }
            }
        }

        Err(last_error.unwrap_or(ApiError::Network("Max retries exceeded".to_string())))
    }
}
