mod commands;
mod db;
mod error;

use std::sync::Mutex;

use tauri::{Manager, RunEvent};

pub struct AppState {
    pub db: Mutex<rusqlite::Connection>,
    pub current_user: Mutex<Option<commands::auth::SessionUser>>,
    pub remember_token: Mutex<Option<String>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let db_path = db::resolve_db_path(app.handle())?;
            log::info!("opening sqlite db at {}", db_path.display());
            let conn = db::open_connection(&db_path)?;
            db::run_migrations(&conn)?;
            db::seed_default_admin(&conn)?;
            app.manage(AppState {
                db: Mutex::new(conn),
                current_user: Mutex::new(None),
                remember_token: Mutex::new(None),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::auth::auth_login,
            commands::auth::auth_logout,
            commands::auth::auth_login_with_token,
            commands::auth::auth_current_user,
        ])
        .build(tauri::generate_context!())
        .expect("failed to build tauri app")
        .run(|_app_handle, event| {
            if let RunEvent::ExitRequested { .. } = event {
                log::info!("exit requested");
            }
        });
}
