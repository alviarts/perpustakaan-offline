mod commands;
mod db;
mod error;
mod services;
mod utils;

use std::sync::Mutex;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, RunEvent, WindowEvent,
};

use crate::commands::close_behavior::{get_close_behavior, CloseBehavior};

pub struct AppState {
    pub db: Mutex<rusqlite::Connection>,
    pub current_user: Mutex<Option<commands::auth::SessionUser>>,
    pub remember_token: Mutex<Option<String>>,
    /// D5-SandboxDemoMode — `true` when the active `db` connection points
    /// at `demo.db`. Mirrors the on-disk `sandbox.flag` so RPC handlers
    /// can branch without re-reading the file on every call.
    pub sandbox_mode: Mutex<bool>,
}

const MAIN_WINDOW_LABEL: &str = "main";

/// Show + focus the main window. Used by the tray icon click handler and the
/// "Buka" menu item to restore the app from minimized-to-tray state.
fn show_main_window(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // D5: ensure the production DB is migrated even when we boot
            // straight into sandbox mode, so the audit log and prod schema
            // stay current. Sandbox mode persists across restarts via the
            // `sandbox.flag` file, so on next launch we mount `demo.db` if
            // the flag is still present.
            let prod_path = db::prod_db_path(app.handle())?;
            {
                let prod_conn = db::open_connection(&prod_path)?;
                db::run_migrations(&prod_conn)?;
                db::seed_default_admin(&prod_conn)?;
            }
            let sandbox_active = db::read_sandbox_flag(app.handle());
            let db_path = if sandbox_active {
                db::demo_db_path(app.handle())?
            } else {
                prod_path.clone()
            };
            log::info!(
                "opening sqlite db at {} (sandbox={})",
                db_path.display(),
                sandbox_active
            );
            let conn = db::open_connection(&db_path)?;
            db::run_migrations(&conn)?;
            db::seed_default_admin(&conn)?;
            app.manage(AppState {
                db: Mutex::new(conn),
                current_user: Mutex::new(None),
                remember_token: Mutex::new(None),
                sandbox_mode: Mutex::new(sandbox_active),
            });

            // BUG-011: build the system tray once at setup. The tray is
            // ALWAYS created (regardless of the user's close-behavior
            // preference) so that a freshly-installed app already has the
            // icon when the user later opens Setting → Aplikasi and toggles
            // "Minimize ke tray".
            let buka_item =
                MenuItem::with_id(app, "tray.buka", "Buka Perpustakaan", true, None::<&str>)?;
            let keluar_item = MenuItem::with_id(app, "tray.keluar", "Keluar", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&buka_item, &keluar_item])?;

            let _tray = TrayIconBuilder::with_id("po-main")
                .tooltip("Perpustakaan Nusantara")
                .icon(
                    app.default_window_icon()
                        .cloned()
                        .ok_or_else(|| tauri::Error::AssetNotFound("default window icon".into()))?,
                )
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "tray.buka" => show_main_window(app),
                    "tray.keluar" => {
                        log::info!("tray: keluar clicked");
                        app.exit(0);
                        // BUG-011 belt-and-suspenders — guarantee process
                        // exit even if WebView2 hangs during shutdown.
                        std::process::exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            // PR-6: spawn the backup-scheduler runner. It ticks every 60s,
            // reads the schedule from settings, and writes auto-backups into
            // <app_data_dir>/backups/. No-op if the schedule is disabled.
            commands::backup_runner::spawn_backup_scheduler(app.handle());

            // Auto-sync scheduler: ticks every 60s, pushes data to Google
            // Sheets if sync.auto.enabled=1 and interval has elapsed.
            commands::sync_runner::spawn_sync_scheduler(app.handle());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::auth::auth_login,
            commands::auth::auth_logout,
            commands::auth::auth_login_with_token,
            commands::auth::auth_current_user,
            commands::auth::auth_get_security_question,
            commands::auth::auth_reset_via_security_question,
            commands::auth::auth_set_security_question,
            commands::identity::identity_get,
            commands::identity::identity_save,
            commands::window_state::window_state_get,
            commands::window_state::window_state_save,
            commands::anggota::anggota_list,
            commands::anggota::anggota_get,
            commands::anggota::anggota_get_by_kode,
            commands::anggota::anggota_create,
            commands::anggota::anggota_update,
            commands::anggota::anggota_delete,
            commands::anggota::anggota_import,
            commands::anggota::anggota_distinct,
            commands::anggota::kelas_list,
            commands::buku::buku_list,
            commands::buku::buku_get,
            commands::buku::buku_create,
            commands::buku::buku_update,
            commands::buku::buku_delete,
            commands::buku::buku_import,
            commands::buku_isbn::buku_isbn_lookup_batch,
            commands::buku_isbn::buku_isbn_fetch_cover,
            // New ISBN scanner commands
            commands::isbn::validate_isbn,
            commands::isbn::convert_isbn10_to_isbn13,
            commands::isbn::convert_isbn13_to_isbn10,
            commands::isbn::lookup_book_by_isbn,
            commands::isbn::lookup_and_download_cover,
            commands::isbn::get_cover_path,
            commands::isbn::delete_cover,
            commands::buku::eksemplar_create,
            commands::buku::eksemplar_delete,
            commands::master_data::master_list,
            commands::master_data::master_create,
            commands::master_data::master_update,
            commands::master_data::master_delete,
            commands::peminjaman::peminjaman_list,
            commands::peminjaman::peminjaman_get,
            commands::peminjaman::eksemplar_resolve,
            commands::peminjaman::peminjaman_aktif_by_eksemplar,
            commands::peminjaman::peminjaman_create,
            commands::peminjaman::peminjaman_kembalikan,
            commands::peminjaman::peminjaman_perpanjang,
            commands::peminjaman::peminjaman_quick_stats,
            commands::peminjaman::peminjaman_overdue_list,
            commands::peminjaman::anggota_loan_history,
            commands::peminjaman::pengembalian_search,
            commands::peminjaman::anggota_summary,
            commands::peminjaman::buku_summary,
            commands::reservasi::reservasi_create,
            commands::reservasi::reservasi_cancel,
            commands::reservasi::reservasi_mark_diambil,
            commands::reservasi::reservasi_list_active,
            commands::reservasi::reservasi_list_by_buku,
            commands::reservasi::reservasi_list_by_anggota,
            commands::reservasi::reservasi_check_expired_tick,
            commands::kunjungan::kunjungan_list,
            commands::kunjungan::kunjungan_create,
            commands::kunjungan::kunjungan_quick_stats,
            commands::kunjungan::kunjungan_delete,
            commands::dashboard::dashboard_kpi,
            commands::dashboard::dashboard_ddc_distribution,
            commands::dashboard::dashboard_kunjungan_7d,
            commands::dashboard::dashboard_top_peminjam,
            commands::dashboard::dashboard_top_buku,
            commands::dashboard::dashboard_trend,
            commands::dashboard::dashboard_heatmap,
            commands::dashboard::dashboard_insights,
            commands::dashboard::dashboard_system_health,
            commands::sandbox::sandbox_status,
            commands::sandbox::sandbox_enable,
            commands::sandbox::sandbox_disable,
            commands::buku_pilihan::buku_pilihan_list_active,
            commands::buku_pilihan::buku_pilihan_pin,
            commands::buku_pilihan::buku_pilihan_unpin,
            commands::buku_pilihan::buku_pilihan_reorder,
            commands::laporan::laporan_grafik,
            commands::laporan::laporan_top_peminjam,
            commands::laporan::laporan_top_buku,
            commands::laporan::laporan_kas,
            commands::kas::kas_create,
            commands::kas::kas_update,
            commands::kas::kas_delete,
            commands::backup::backup_create,
            commands::backup::backup_restore,
            commands::backup::backup_schedule_get,
            commands::backup::backup_schedule_set,
            commands::backup::backup_db_path,
            commands::backup_extra::backup_history_list,
            commands::backup_extra::backup_history_get,
            commands::backup_extra::backup_history_delete,
            commands::backup_extra::backup_create_history,
            commands::backup_extra::backup_create_encrypted,
            commands::backup_extra::backup_restore_encrypted,
            commands::backup_extra::backup_cloud_settings_get,
            commands::backup_extra::backup_cloud_settings_set,
            commands::backup_extra::backup_cloud_upload,
            commands::export::export_write_bytes,
            commands::kta::kta_template_list,
            commands::kta::kta_template_get,
            commands::kta::kta_template_create,
            commands::kta::kta_template_update,
            commands::kta::kta_template_delete,
            commands::kta::kta_template_set_default,
            commands::kta_export::kta_export_pdf,
            commands::kta_export::kta_open_exports_folder,
            commands::label_buku::label_buku_template_list,
            commands::label_buku::label_buku_template_get,
            commands::label_buku::label_buku_template_create,
            commands::label_buku::label_buku_template_update,
            commands::label_buku::label_buku_template_delete,
            commands::label_buku::label_buku_template_set_default,
            commands::label_buku_export::label_buku_export_pdf,
            commands::label_buku_export::label_buku_open_exports_folder,
            commands::settings::settings_get_many,
            commands::settings::settings_set_many,
            commands::settings::settings_users_list,
            commands::settings::settings_users_create,
            commands::settings::settings_users_update,
            commands::settings::settings_users_delete,
            commands::settings::settings_users_reset_password,
            commands::settings::settings_permissions_get,
            commands::settings::settings_permissions_save,
            commands::settings::settings_audit_log_query,
            commands::close_behavior::close_behavior_get,
            commands::close_behavior::close_behavior_set,
            commands::close_behavior::force_quit,
            commands::assets::assets_save,
            commands::assets::assets_resolve,
            commands::assets::assets_delete,
            commands::assets::assets_read_data_url,
            commands::assets::assets_refit_anggota_photos,
            commands::user_profile::user_profile_get,
            commands::user_profile::user_profile_update,
            commands::stocktake::stocktake_start,
            commands::stocktake::stocktake_session_list,
            commands::stocktake::stocktake_session_get,
            commands::stocktake::stocktake_item_list,
            commands::stocktake::stocktake_scan,
            commands::stocktake::stocktake_finish,
            commands::stocktake::stocktake_session_delete,
            commands::surat::surat_check_eligibility,
            commands::surat::surat_generate,
            commands::surat::surat_log_list,
            commands::wishlist::wishlist_create,
            commands::wishlist::wishlist_list,
            commands::wishlist::wishlist_update_status,
            commands::wishlist::wishlist_upvote,
            commands::wishlist::wishlist_delete,
            commands::sync::sync_test_connection,
            commands::sync::sync_push_now,
            commands::sync::sync_pull_now,
            commands::sync::sync_status,
            commands::sync::sync_full_now,
            commands::sync::sync_save_service_account,
            commands::sync::sync_generate_mobile_qr,
            commands::sync::sync_export_mobile_qr,
        ])
        .on_window_event(|window, event| {
            // BUG-011: intercept the X-button on the main window and
            // either (a) hide it into the tray when the user has opted
            // in, or (b) let Tauri tear it down and then guarantee the
            // process actually exits (some WebView2 builds otherwise leave
            // a zombie .exe in Task Manager).
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() != MAIN_WINDOW_LABEL {
                    return;
                }
                let app = window.app_handle();
                let behavior = app
                    .try_state::<AppState>()
                    .and_then(|state| get_close_behavior(&state).ok())
                    .unwrap_or_default();
                match behavior {
                    CloseBehavior::Tray => {
                        log::info!("close_requested: hiding main window to tray");
                        api.prevent_close();
                        let _ = window.hide();
                    }
                    CloseBehavior::Exit => {
                        log::info!("close_requested: exiting application");
                        // Let Tauri unwind the window first, then guarantee
                        // the process exits — see force_quit for rationale.
                        let app_handle = app.clone();
                        std::thread::spawn(move || {
                            // Tiny delay so the window event loop can flush
                            // the WindowEvent::Destroyed before we hard-exit.
                            std::thread::sleep(std::time::Duration::from_millis(150));
                            app_handle.exit(0);
                            std::process::exit(0);
                        });
                    }
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("failed to build tauri app")
        .run(|_app_handle, event| {
            if let RunEvent::ExitRequested { .. } = event {
                log::info!("exit requested");
            }
        });
}
