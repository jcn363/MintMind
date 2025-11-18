// PTY Commands
#[tauri::command]
pub async fn pty_spawn(
    config: crate::pty::SpawnConfig,
) -> Result<crate::pty::SpawnResult, String> {
    crate::pty::spawn_pty(config)
}

#[tauri::command]
pub async fn pty_write(pty_id: String, data: String) -> Result<(), String> {
    let decoded_data = base64::engine::general_purpose::STANDARD
        .decode(&data)
        .map_err(|e| format!("Failed to decode base64 data: {}", e))?;
    let data_str = String::from_utf8_lossy(&decoded_data);
    crate::pty::write_to_pty(&pty_id, &data_str).await
}

#[tauri::command]
pub async fn pty_read(pty_id: String) -> Result<String, String> {
    crate::pty::read_from_pty(&pty_id).await
}

#[tauri::command]
pub async fn pty_resize(pty_id: String, cols: u16, rows: u16) -> Result<(), String> {
    crate::pty::resize_pty(&pty_id, cols, rows).await
}

#[tauri::command]
pub async fn pty_kill(pty_id: String) -> Result<(), String> {
    crate::pty::kill_pty(&pty_id).await
}

#[tauri::command]
pub async fn pty_get_info(pty_id: String) -> Result<serde_json::Value, String> {
    crate::pty::get_pty_info(&pty_id).await
}

// Keyboard Layout Commands
#[tauri::command]
pub async fn get_keyboard_layout_data() -> Result<crate::keyboard::KeyboardLayoutData, String> {
    crate::keyboard::get_keyboard_layout_data()
}
#[tauri::command]
pub async fn get_available_keyboard_layouts() -> Result<Vec<crate::keyboard::KeyboardLayoutInfo>, String> {
    crate::keyboard::get_available_keyboard_layouts()
}

// Windows Registry Commands
#[cfg(target_os = "windows")]
#[tauri::command]
pub async fn windows_get_string_reg_key(
    hive: String,
    path: String,
    name: String,
) -> Result<String, String> {
    crate::windows_registry::get_string_value(&hive, &path, &name)
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub async fn windows_get_dword_reg_key(
    hive: String,
    path: String,
    name: String,
) -> Result<u32, String> {
    crate::windows_registry::get_dword_value(&hive, &path, &name)
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub async fn windows_get_binary_reg_key(
    hive: String,
    path: String,
    name: String,
) -> Result<Vec<u8>, String> {
    crate::windows_registry::get_binary_value(&hive, &path, &name)
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub async fn windows_enum_reg_subkeys(hive: String, path: String) -> Result<Vec<String>, String> {
    crate::windows_registry::enum_subkeys(&hive, &path)
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub async fn windows_enum_reg_values(hive: String, path: String) -> Result<serde_json::Value, String> {
    crate::windows_registry::enum_values(&hive, &path)
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub async fn windows_reg_key_exists(hive: String, path: String) -> Result<bool, String> {
    crate::windows_registry::key_exists(&hive, &path)
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub async fn windows_reg_value_exists(
    hive: String,
    path: String,
    name: String,
) -> Result<bool, String> {
    crate::windows_registry::value_exists(&hive, &path, &name)
}

// Process Tree Commands
#[tauri::command]
pub async fn get_process_tree(root_pid: u32) -> Result<crate::windows_process::ProcessInfo, String> {
    crate::windows_process::get_process_tree(root_pid)
}

#[tauri::command]
pub async fn get_process_list_flat(root_pid: u32) -> Result<Vec<crate::windows_process::ProcessInfo>, String> {
    crate::windows_process::get_process_list_flat(root_pid)
}

#[tauri::command]
pub async fn get_single_process_info(pid: u32) -> Result<crate::windows_process::ProcessInfo, String> {
    crate::windows_process::get_single_process_info(pid)
}

#[tauri::command]
pub async fn get_all_system_processes() -> Result<Vec<crate::windows_process::ProcessInfo>, String> {
    crate::windows_process::get_all_system_processes()
}

#[tauri::command]
pub async fn find_processes_by_name(name: String) -> Result<Vec<crate::windows_process::ProcessInfo>, String> {
    crate::windows_process::find_processes_by_name(&name)
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub async fn get_shell_executable(root_pid: u32) -> Result<String, String> {
    crate::windows_process::get_shell_executable(root_pid)
}