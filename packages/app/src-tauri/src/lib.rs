mod db;
mod sync;
mod vector;

use std::sync::Mutex;
use vector::VectorDBState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    unsafe {
        rusqlite::ffi::sqlite3_auto_extension(Some(std::mem::transmute(
            sqlite_vec::sqlite3_vec_init as *const (),
        )));
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_websocket::init())
        .manage(VectorDBState {
            db: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            sync::commands::sync_vacuum_into,
            sync::commands::sync_integrity_check,
            sync::commands::sync_hash_file,
            vector::vector_insert,
            vector::vector_delete_by_book,
            vector::vector_search,
            vector::vector_get_stats,
            vector::vector_rebuild,
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();
            if let Err(e) = db::init_database_sync(&app_handle) {
                eprintln!("[DB] Failed to initialize database: {}", e);
            }
            match vector::init_vector_db(&app_handle) {
                Ok(_) => println!("[VectorDB] Initialized successfully"),
                Err(e) => eprintln!("[VectorDB] Failed to initialize: {}", e),
            }
            unsafe {
                rusqlite::ffi::sqlite3_cancel_auto_extension(Some(std::mem::transmute(
                    sqlite_vec::sqlite3_vec_init as *const (),
                )));
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
