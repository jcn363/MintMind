use serde_json::Value;

// Validaciones para comandos Tauri - FASE 2

pub fn validate_zoom_level(level: f64) -> Result<(), String> {
    if level < 0.1 || level > 5.0 {
        return Err("Nivel de zoom debe estar entre 0.1 y 5.0".to_string());
    }
    Ok(())
}

pub fn validate_auxiliary_window_id(id: u32) -> Result<(), String> {
    if id == 0 {
        return Err("ID de ventana auxiliar debe ser mayor que 0".to_string());
    }
    Ok(())
}

pub fn validate_diagnostic_options(options: &Value) -> Result<(), String> {
    if !options.is_object() {
        return Err("Opciones de diagnóstico deben ser un objeto".to_string());
    }
    Ok(())
}

pub fn validate_chat_request_args(args: &Value) -> Result<(), String> {
    if !args.is_object() {
        return Err("Argumentos de chat deben ser un objeto".to_string());
    }
    Ok(())
}

pub fn validate_open_files_request(request: &Value) -> Result<(), String> {
    if !request.is_object() {
        return Err("Request de archivos debe ser un objeto".to_string());
    }
    Ok(())
}

pub fn validate_add_remove_folders_request(request: &Value) -> Result<(), String> {
    if !request.is_object() {
        return Err("Request de carpetas debe ser un objeto".to_string());
    }
    Ok(())
}

pub fn validate_run_action_request(request: &Value) -> Result<(), String> {
    if !request.is_object() {
        return Err("Request de acción debe ser un objeto".to_string());
    }
    Ok(())
}

pub fn validate_run_keybinding_request(request: &Value) -> Result<(), String> {
    if !request.is_object() {
        return Err("Request de atajo debe ser un objeto".to_string());
    }
    Ok(())
}

pub fn validate_crash_report_data(data: &Value) -> Result<(), String> {
    if !data.is_object() {
        return Err("Datos de crash deben ser un objeto".to_string());
    }
    Ok(())
}

pub fn validate_info_message(message: &str) -> Result<(), String> {
    if message.trim().is_empty() {
        return Err("Mensaje no puede estar vacío".to_string());
    }
    Ok(())
}

pub fn validate_error_message(message: &str) -> Result<(), String> {
    if message.trim().is_empty() {
        return Err("Mensaje de error no puede estar vacío".to_string());
    }
    Ok(())
}

pub fn validate_shell_environment_request(request: &Value) -> Result<(), String> {
    if !request.is_object() {
        return Err("Request de entorno debe ser un objeto".to_string());
    }
    Ok(())
}

pub fn validate_test_vscode_cli_request(request: &Value) -> Result<(), String> {
    if !request.is_object() {
        return Err("Request de CLI debe ser un objeto".to_string());
    }
    Ok(())
}

pub fn validate_resolve_shell_env_request(request: &Value) -> Result<(), String> {
    if !request.is_object() {
        return Err("Request de resolución debe ser un objeto".to_string());
    }
    Ok(())
}

pub fn validate_update_touch_bar_menu_request(request: &Value) -> Result<(), String> {
    if !request.is_object() {
        return Err("Request de Touch Bar debe ser un objeto".to_string());
    }
    Ok(())
}

pub fn validate_configure_runtime_arguments_request(request: &Value) -> Result<(), String> {
    if !request.is_object() {
        return Err("Request de argumentos debe ser un objeto".to_string());
    }
    Ok(())
}

pub fn validate_file_path(path: &str) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("Ruta de archivo no puede estar vacía".to_string());
    }
    Ok(())
}

pub fn validate_proxy_auth_payload(payload: &Value) -> Result<(), String> {
    if !payload.is_object() {
        return Err("Payload de autenticación debe ser un objeto".to_string());
    }
    Ok(())
}

pub fn validate_unc_host(host: &str) -> Result<(), String> {
    if host.trim().is_empty() {
        return Err("Host UNC no puede estar vacío".to_string());
    }
    Ok(())
}

pub fn validate_protocol_kind(kind: &str) -> Result<(), String> {
    if kind.trim().is_empty() {
        return Err("Tipo de protocolo no puede estar vacío".to_string());
    }
    Ok(())
}
// Dialog validation functions
pub fn validate_dialog_type(dialog_type: &str) -> Result<(), String> {
    let valid_types = ["none", "info", "error", "question", "warning"];
    if !valid_types.contains(&dialog_type) {
        return Err(format!("Tipo de diálogo inválido: {}. Debe ser uno de: {}", dialog_type, valid_types.join(", ")));
    }
    Ok(())
}

pub fn validate_buttons(buttons: &[String]) -> Result<(), String> {
    // Allow up to 3 buttons
    if buttons.is_empty() || buttons.len() > 3 {
        return Err("Debe proporcionar entre 1 y 3 botones".to_string());
    }
    for button in buttons {
        if button.trim().is_empty() {
            return Err("Los botones no pueden estar vacíos".to_string());
        }
    }
    Ok(())
}

pub fn validate_title(title: &str) -> Result<(), String> {
    if title.trim().is_empty() {
        return Err("El título no puede estar vacío".to_string());
    }
    if title.len() > 200 {
        return Err("El título no puede tener más de 200 caracteres".to_string());
    }
    Ok(())
}

pub fn validate_path(path: &str, is_absolute: bool) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("La ruta no puede estar vacía".to_string());
    }
    
    if is_absolute && !std::path::Path::new(path).is_absolute() {
        return Err("La ruta debe ser absoluta".to_string());
    }
    
    // Additional path validation could be added here
    Ok(())
}

pub fn validate_file_filters(filters: &Option<Vec<(String, Vec<String>)>>) -> Result<(), String> {
    if let Some(filters_vec) = filters {
        for (name, extensions) in filters_vec {
            if name.trim().is_empty() {
                return Err("El nombre del filtro no puede estar vacío".to_string());
            }
            if extensions.is_empty() {
                return Err(format!("El filtro '{}' debe tener al menos una extensión", name));
            }
            for ext in extensions {
                if ext.trim().is_empty() {
                    return Err("Las extensiones no pueden estar vacías".to_string());
                }
                // Accept extensions without dots
                let ext_trimmed = ext.trim();
                if !ext_trimmed.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-') {
                    return Err(format!("La extensión '{}' contiene caracteres inválidos", ext));
                }
            }
        }
    }
    Ok(())
}

pub fn validate_open_dialog_properties(properties: &[String]) -> Result<(), String> {
    let valid_properties = [
        "openFile", "openDirectory", "multiSelections"
    ];

    for prop in properties {
        if !valid_properties.contains(&prop.as_str()) {
            return Err(format!("Propiedad inválida: {}. Propiedades válidas: {}", prop, valid_properties.join(", ")));
        }
    }
    Ok(())
}
pub fn validate_url(url: &str) -> Result<(), String> {
    if url.trim().is_empty() {
        return Err("URL no puede estar vacía".to_string());
    }
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("URL debe comenzar con http:// o https://".to_string());
    }
    Ok(())
}
// Filesystem validation functions
pub fn validate_fs_path(path: &str) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("Filesystem path cannot be empty".to_string());
    }

    // Basic path validation - rely on normalization for traversal checks
    if let Err(_) = std::path::Path::new(path).canonicalize() {
        return Err(format!("Invalid path format: {}", path));
    }

    Ok(())
}

pub fn validate_file_content(content: &str) -> Result<(), String> {
    // Check for reasonable content size (100MB limit)
    const MAX_SIZE: usize = 100 * 1024 * 1024; // 100MB
    if content.len() > MAX_SIZE {
        return Err(format!("File content too large: {} bytes (max: {} bytes)", content.len(), MAX_SIZE));
    }
    Ok(())
}

pub fn validate_directory_path(path: &str) -> Result<(), String> {
    validate_fs_path(path)?;

    let path_obj = std::path::Path::new(path);
    if !path_obj.is_dir() && !path_obj.parent().map_or(false, |p| p.exists()) {
        return Err(format!("Parent directory does not exist for path: {}", path));
    }

    Ok(())
}

pub fn validate_copy_operation(from: &str, to: &str) -> Result<(), String> {
    validate_fs_path(from)?;
    validate_fs_path(to)?;

    if from == to {
        return Err("Source and destination paths cannot be the same".to_string());
    }

    // Check if source exists
    if !std::path::Path::new(from).exists() {
        return Err(format!("Source path does not exist: {}", from));
    }

    Ok(())
}

pub fn validate_move_operation(from: &str, to: &str) -> Result<(), String> {
    validate_copy_operation(from, to)?;

    // Additional validation for move operations
    let from_path = std::path::Path::new(from);
    let to_path = std::path::Path::new(to);

    // Prevent moving a directory into itself
    if from_path.is_dir() && to_path.starts_with(from_path) {
        return Err("Cannot move a directory into itself or its subdirectories".to_string());
    }

    Ok(())
}

pub fn validate_atomic_write(path: &str, content: &str) -> Result<(), String> {
    validate_fs_path(path)?;
    validate_file_content(content)?;

    // Ensure we can create the temporary file
    let temp_path = format!("{}.tmp", path);
    validate_fs_path(&temp_path)?;

    Ok(())
}

pub fn validate_search_pattern(pattern: &str) -> Result<(), String> {
    if pattern.trim().is_empty() {
        return Err("Search pattern cannot be empty".to_string());
    }

    // Basic regex validation - prevent potentially dangerous patterns
    if pattern.contains("(?R)") || pattern.contains("\\g<") {
        return Err("Recursive regex patterns not allowed".to_string());
    }

    Ok(())
}

pub fn validate_platform_path(path: &str) -> Result<(), String> {
    validate_fs_path(path)?;

    // Platform-specific validations
    #[cfg(windows)]
    {
        // Windows-specific validations
        if path.contains(":") && !path.chars().nth(1).map_or(false, |c| c == ':') {
            return Err("Invalid Windows path format".to_string());
        }

        // Prevent UNC paths that might cause issues
        if path.starts_with("\\\\") {
            return Err("UNC paths are not supported".to_string());
        }
    }

    #[cfg(unix)]
    {
        // Unix-specific validations
        if path.contains("\\") {
            return Err("Backslashes not allowed in Unix paths".to_string());
        }
    }

    Ok(())
}
