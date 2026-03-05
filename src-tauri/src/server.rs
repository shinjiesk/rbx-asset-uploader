use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

const SERVER_PORT: u16 = 58750;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudioSession {
    pub session_id: String,
    pub place_id: Option<u64>,
    pub place_name: Option<String>,
    pub last_heartbeat: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudioCommand {
    pub command_type: String,
    pub instance_path: String,
    pub source: String,
}

#[derive(Debug, Default)]
pub struct ServerState {
    pub sessions: HashMap<String, StudioSession>,
    pub command_queues: HashMap<String, Vec<StudioCommand>>,
}

pub type SharedServerState = Arc<Mutex<ServerState>>;

pub fn create_shared_state() -> SharedServerState {
    Arc::new(Mutex::new(ServerState::default()))
}

#[derive(Debug, Deserialize)]
struct RegisterRequest {
    place_id: Option<u64>,
    place_name: Option<String>,
}

#[derive(Debug, Serialize)]
struct RegisterResponse {
    session_id: String,
}

#[derive(Debug, Serialize)]
struct CommandsResponse {
    commands: Vec<StudioCommand>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct ResultRequest {
    success: bool,
    error: Option<String>,
}

async fn register_session(
    State(state): State<SharedServerState>,
    Json(req): Json<RegisterRequest>,
) -> impl IntoResponse {
    let session_id = uuid::Uuid::new_v4().to_string();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let session = StudioSession {
        session_id: session_id.clone(),
        place_id: req.place_id,
        place_name: req.place_name,
        last_heartbeat: now,
    };

    let mut state = state.lock().await;
    state.sessions.insert(session_id.clone(), session);
    state.command_queues.insert(session_id.clone(), Vec::new());

    (StatusCode::OK, Json(RegisterResponse { session_id }))
}

async fn poll_commands(
    State(state): State<SharedServerState>,
    Path(session_id): Path<String>,
) -> impl IntoResponse {
    let mut state = state.lock().await;

    if let Some(session) = state.sessions.get_mut(&session_id) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        session.last_heartbeat = now;
    }

    let commands = state
        .command_queues
        .get_mut(&session_id)
        .map(std::mem::take)
        .unwrap_or_default();

    (StatusCode::OK, Json(CommandsResponse { commands }))
}

async fn heartbeat(
    State(state): State<SharedServerState>,
    Path(session_id): Path<String>,
) -> impl IntoResponse {
    let mut state = state.lock().await;
    if let Some(session) = state.sessions.get_mut(&session_id) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        session.last_heartbeat = now;
        StatusCode::OK
    } else {
        StatusCode::NOT_FOUND
    }
}

async fn report_result(
    State(_state): State<SharedServerState>,
    Path(_session_id): Path<String>,
    Json(_req): Json<ResultRequest>,
) -> impl IntoResponse {
    StatusCode::OK
}

async fn health() -> impl IntoResponse {
    (StatusCode::OK, Json(serde_json::json!({"status": "ok", "app": "rbx-asset-uploader"})))
}

pub async fn start_http_server(state: SharedServerState) {
    let app = Router::new()
        .route("/api/health", get(health))
        .route("/api/register", post(register_session))
        .route("/api/commands/{session_id}", get(poll_commands))
        .route("/api/heartbeat/{session_id}", post(heartbeat))
        .route("/api/result/{session_id}", post(report_result))
        .with_state(state);

    let listener = match tokio::net::TcpListener::bind(format!("127.0.0.1:{SERVER_PORT}")).await {
        Ok(l) => l,
        Err(e) => {
            eprintln!("Failed to bind HTTP server on port {SERVER_PORT}: {e}");
            return;
        }
    };

    eprintln!("Studio bridge HTTP server listening on http://127.0.0.1:{SERVER_PORT}");
    if let Err(e) = axum::serve(listener, app).await {
        eprintln!("HTTP server error: {e}");
    }
}
