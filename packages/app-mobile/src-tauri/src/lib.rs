mod db;
mod sync;

#[cfg(target_os = "ios")]
mod webview_helper;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_websocket::init())
        .invoke_handler(tauri::generate_handler![
            sync::commands::sync_test_connection,
            sync::commands::sync_configure,
            sync::commands::sync_get_config,
            sync::commands::sync_now,
            sync::commands::sync_get_status,
            sync::commands::sync_hash_file,
            sync::commands::sync_set_auto_sync,
            sync::commands::sync_reset,
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();
            if let Err(e) = db::init_database_sync(&app_handle) {
                eprintln!("Failed to initialize database: {}", e);
            }

            #[cfg(target_os = "ios")]
            {
                use tauri::Manager;
                if let Some(webview_window) = app_handle.get_webview_window("main") {
                    webview_helper::initialize_keyboard_adjustment(&webview_window);
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
