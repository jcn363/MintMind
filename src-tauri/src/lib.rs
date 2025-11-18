pub mod modules {
    pub mod pty;
    pub mod keyboard;
    pub mod registry;
    pub mod process;
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      // PTY commands
      commands::pty_spawn,
      commands::pty_write,
      commands::pty_read,
      commands::pty_resize,
      commands::pty_kill,
      commands::pty_get_info,
      // Keyboard layout commands
      commands::get_keyboard_layout_data,
      commands::get_available_keyboard_layouts,
      // Windows registry commands
      commands::windows_get_string_reg_key,
      commands::windows_get_dword_reg_key,
      commands::windows_get_binary_reg_key,
      commands::windows_enum_reg_subkeys,
      commands::windows_enum_reg_values,
      commands::windows_reg_key_exists,
      commands::windows_reg_value_exists,
      // Process tree commands
      get_process_tree,
      get_process_list_flat,
      get_single_process_info,
      get_all_system_processes,
      find_processes_by_name,
      terminate_process,
      kill_process_tree,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
