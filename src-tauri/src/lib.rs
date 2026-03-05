mod api;
mod codegen;
mod commands;
mod keystore;
mod lockfile;
mod server;
mod upload;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let server_state = server::create_shared_state();
    let server_state_for_axum = server_state.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(server_state)
        .invoke_handler(tauri::generate_handler![
            commands::save_api_key,
            commands::load_api_key,
            commands::delete_api_key,
            commands::has_api_key,
            commands::scan_files,
            commands::upload_files,
            commands::load_lock_file,
            commands::generate_assets_lua,
            commands::get_studio_sessions,
            commands::push_to_studio,
        ])
        .setup(move |_app| {
            let state = server_state_for_axum;
            std::thread::spawn(move || {
                let rt = tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");
                rt.block_on(server::start_http_server(state));
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
