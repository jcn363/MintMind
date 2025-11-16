// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod dialog;
mod shell;
mod validations;
mod fs;

use std::collections::HashMap;
use std::sync::Mutex;
use commands::*;
use dialog::*;
use shell::{show_item_in_folder, open_external, move_item_to_trash};
use fs::*;
use std::io::{Read, Write};
// Estado global para PTY y autenticación
static PTY_SESSIONS: std::sync::LazyLock<Mutex<HashMap<String, Box<dyn portable_pty::Child + Send>>>> = std::sync::LazyLock::new(|| Mutex::new(HashMap::new()));
static MICROSOFT_TOKENS: std::sync::LazyLock<Mutex<HashMap<String, MicrosoftToken>>> = std::sync::LazyLock::new(|| Mutex::new(HashMap::new()));
static MICROSOFT_SESSIONS: std::sync::LazyLock<Mutex<HashMap<String, MicrosoftAuthSession>>> = std::sync::LazyLock::new(|| Mutex::new(HashMap::new()));
static PTY_READERS: std::sync::LazyLock<Mutex<HashMap<String, Box<dyn Read + Send>>>> = std::sync::LazyLock::new(|| Mutex::new(HashMap::new()));
static PTY_WRITERS: std::sync::LazyLock<Mutex<HashMap<String, Box<dyn Write + Send>>>> = std::sync::LazyLock::new(|| Mutex::new(HashMap::new()));

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            github_login,
            github_refresh_token,
            github_logout,
            github_get_sessions,
            github_validate_token,
            show_message_box,
            show_save_dialog,
            show_open_dialog,
            show_item_in_folder,
            open_external,
            move_item_to_trash,
            read_text_file,
            read_binary_file,
            write_text_file,
            write_binary_file,
            exists,
            metadata,
            read_dir,
            create_dir,
            remove_file,
            remove_dir,
            remove_dir_all,
            copy_file,
            rename,
            write_file_atomic,
            copy_dir_atomic,
            current_dir,
            home_dir,
            temp_dir,
            path_separator
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}