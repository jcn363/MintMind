//! Filesystem operations module for MintMind Tauri application
//! Provides comprehensive file system operations with proper error handling,
//! atomic operations, and cross-platform compatibility.

use std::collections::HashMap;
use std::fs;
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{command, AppHandle, State};
use serde::{Deserialize, Serialize};
use crate::validations::{validate_fs_path, validate_platform_path, validate_directory_path};


// Global state for file operations (for potential future use with locking)
static FILE_OPERATIONS: std::sync::LazyLock<Mutex<HashMap<String, FileOperation>>> = std::sync::LazyLock::new(|| Mutex::new(HashMap::new()));

/// Represents a file operation in progress
#[derive(Clone, Debug)]
struct FileOperation {
    operation_type: String,
    path: PathBuf,
    start_time: u64,
}

/// File metadata structure
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FileMetadata {
    pub path: String,
    pub size: u64,
    pub is_dir: bool,
    pub is_file: bool,
    pub modified: Option<u64>,
    pub created: Option<u64>,
    pub readonly: bool,
}

/// Directory entry structure
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_file: bool,
    pub size: Option<u64>,
    pub modified: Option<u64>,
}

/// Copy options for file operations
#[derive(Deserialize, Clone, Debug)]
pub struct CopyOptions {
    pub overwrite: Option<bool>,
    pub recursive: Option<bool>,
}

/// Move options for file operations
#[derive(Deserialize, Clone, Debug)]
pub struct MoveOptions {
    pub overwrite: Option<bool>,
}

/// Search options for file operations
#[derive(Deserialize, Clone, Debug)]
pub struct SearchOptions {
    pub pattern: Option<String>,
    pub case_sensitive: Option<bool>,
    pub recursive: Option<bool>,
}

// =============================================================================
// CORE FILESYSTEM OPERATIONS
// =============================================================================

/// Read the contents of a file as a string
#[command]
pub async fn read_text_file(app: AppHandle, path: String) -> Result<String, String> {
    use tauri_plugin_fs::FsExt;
    use std::io::{Error, ErrorKind};

    match app.fs().read(&path).and_then(|bytes| String::from_utf8(bytes).map_err(|_| Error::new(ErrorKind::InvalidData, "Invalid UTF-8"))) {
        Ok(content) => Ok(content),
        Err(e) => Err(format!("Failed to read file '{}': {}", path, e)),
    }
}

/// Read the contents of a file as bytes
#[command]
pub async fn read_binary_file(app: AppHandle, path: String) -> Result<Vec<u8>, String> {
    use tauri_plugin_fs::FsExt;

    match app.fs().read(&path) {
        Ok(content) => Ok(content),
        Err(e) => Err(format!("Failed to read binary file '{}': {}", path, e)),
    }
}

/// Write text content to a file
#[command]
pub async fn write_text_file(app: AppHandle, path: String, content: String) -> Result<(), String> {
    use tauri_plugin_fs::FsExt;

    match app.fs().write(&path, content.as_bytes()) {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to write file '{}': {}", path, e)),
    }
}

/// Write binary content to a file
#[command]
pub async fn write_binary_file(app: AppHandle, path: String, content: Vec<u8>) -> Result<(), String> {
    use tauri_plugin_fs::FsExt;

    match app.fs().write(&path, &content) {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to write binary file '{}': {}", path, e)),
    }
}

/// Check if a path exists
#[command]
pub async fn exists(app: AppHandle, path: String) -> Result<bool, String> {
    use tauri_plugin_fs::FsExt;

    Ok(app.fs().exists(&path))
}

/// Get metadata for a file or directory
#[command]
pub async fn metadata(app: AppHandle, path: String) -> Result<FileMetadata, String> {
    use tauri_plugin_fs::FsExt;
    use std::time::{SystemTime, UNIX_EPOCH};

    let metadata = match app.fs().metadata(&path) {
        Ok(m) => m,
        Err(e) => return Err(format!("Failed to get metadata for '{}': {}", path, e)),
    };

    let modified = metadata.modified
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs());

    let created = metadata.created
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs());

    Ok(FileMetadata {
        path: path.clone(),
        size: metadata.size,
        is_dir: metadata.is_dir,
        is_file: metadata.is_file,
        modified,
        created,
        readonly: metadata.readonly,
    })
}

// =============================================================================
// ADVANCED FILESYSTEM OPERATIONS
// =============================================================================

/// Read directory contents
#[command]
pub async fn read_dir(app: AppHandle, path: String) -> Result<Vec<DirEntry>, String> {
    use tauri_plugin_fs::FsExt;
    use std::time::{SystemTime, UNIX_EPOCH};

    let entries = match app.fs().read_dir(&path) {
        Ok(entries) => entries,
        Err(e) => return Err(format!("Failed to read directory '{}': {}", path, e)),
    };

    let mut result = Vec::new();

    for entry in entries {
        let modified = entry.modified
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs());

        result.push(DirEntry {
            name: entry.name,
            path: entry.path,
            is_dir: entry.is_dir,
            is_file: entry.is_file,
            size: if entry.is_file { Some(entry.size) } else { None },
            modified,
        });
    }

    Ok(result)
}

/// Create a directory (and parent directories if needed)
#[command]
pub async fn create_dir(app: AppHandle, path: String) -> Result<(), String> {
    use tauri_plugin_fs::FsExt;

    match app.fs().create_dir_all(&path) {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to create directory '{}': {}", path, e)),
    }
}

/// Remove a file
#[command]
pub async fn remove_file(app: AppHandle, path: String) -> Result<(), String> {
    use tauri_plugin_fs::FsExt;

    match app.fs().remove(&path) {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to remove file '{}': {}", path, e)),
    }
}

/// Remove a directory (must be empty)
#[command]
pub async fn remove_dir(app: AppHandle, path: String) -> Result<(), String> {
    use tauri_plugin_fs::FsExt;

    match app.fs().remove_dir(&path) {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to remove directory '{}': {}", path, e)),
    }
}

/// Remove a directory and all its contents recursively
#[command]
pub async fn remove_dir_all(app: AppHandle, path: String) -> Result<(), String> {
    use tauri_plugin_fs::FsExt;

    match app.fs().remove_dir_all(&path) {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to remove directory recursively '{}': {}", path, e)),
    }
}

/// Copy a file from source to destination
#[command]
pub async fn copy_file(app: AppHandle, from: String, to: String, options: Option<CopyOptions>) -> Result<u64, String> {
    use tauri_plugin_fs::FsExt;

    let options = options.unwrap_or(CopyOptions {
        overwrite: Some(false),
        recursive: Some(false),
    });

    match app.fs().copy(&from, &to) {
        Ok(bytes) => Ok(bytes),
        Err(e) => Err(format!("Failed to copy file from '{}' to '{}': {}", from, to, e)),
    }
}

/// Rename/move a file or directory
#[command]
pub async fn rename(app: AppHandle, from: String, to: String, options: Option<MoveOptions>) -> Result<(), String> {
    use tauri_plugin_fs::FsExt;

    let options = options.unwrap_or(MoveOptions {
        overwrite: Some(false),
    });

    match app.fs().rename(&from, &to) {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to rename '{}' to '{}': {}", from, to, e)),
    }
}

// =============================================================================
// ATOMIC OPERATIONS
// =============================================================================

/// Atomically write content to a file using a temporary file
/// Note: This operation uses plugin permissions for atomic writes
#[command]
pub async fn write_file_atomic(app: AppHandle, path: String, content: String) -> Result<(), String> {
    use tauri_plugin_fs::FsExt;

    validate_write_path(&path)?;

    // Create temporary file path
    let temp_path = format!("{}.tmp", path);
    validate_write_path(&temp_path)?;

    // Ensure parent directory exists
    if let Some(parent) = Path::new(&path).parent() {
        if let Err(e) = app.fs().create_dir_all(&parent.to_string_lossy()) {
            return Err(format!("Failed to create parent directory: {}", e));
        }
    }

    // Write to temporary file first
    if let Err(e) = app.fs().write(&temp_path, content.as_bytes()) {
        // Clean up temp file if write failed
        let _ = app.fs().remove(&temp_path);
        return Err(format!("Failed to write temporary file: {}", e));
    }

    // Atomically rename temporary file to target file
    match app.fs().rename(&temp_path, &path) {
        Ok(_) => Ok(()),
        Err(e) => {
            // Clean up temp file if rename failed
            let _ = app.fs().remove(&temp_path);
            Err(format!("Failed to atomically rename file: {}", e))
        }
    }
}

/// Copy directory recursively with atomic operations
/// Note: This operation uses plugin permissions for atomic directory copying
#[command]
pub async fn copy_dir_atomic(app: AppHandle, from: String, to: String) -> Result<(), String> {
    use tauri_plugin_fs::FsExt;

    validate_read_path(&from)?;
    validate_write_path(&to)?;

    let from_path = Path::new(&from);
    let to_path = Path::new(&to);

    if !from_path.is_dir() {
        return Err(format!("Source '{}' is not a directory", from));
    }

    // Create destination directory
    if let Err(e) = app.fs().create_dir_all(&to) {
        return Err(format!("Failed to create destination directory: {}", e));
    }

    // Copy all entries recursively using plugin APIs
    copy_dir_recursive_plugin(&app, &from, &to).await
}

// =============================================================================
// PLATFORM-SPECIFIC OPERATIONS
// =============================================================================

/// Get the current working directory
#[command]
pub async fn current_dir() -> Result<String, String> {
    match std::env::current_dir() {
        Ok(path) => Ok(path.to_string_lossy().to_string()),
        Err(e) => Err(format!("Failed to get current directory: {}", e)),
    }
}

/// Get the user's home directory
#[command]
pub async fn home_dir() -> Result<String, String> {
    match dirs::home_dir() {
        Some(path) => Ok(path.to_string_lossy().to_string()),
        None => Err("Failed to get home directory".to_string()),
    }
}

/// Get the temporary directory
#[command]
pub async fn temp_dir() -> Result<String, String> {
    Ok(std::env::temp_dir().to_string_lossy().to_string())
}

/// Get path separator for the current platform
#[command]
pub async fn path_separator() -> Result<String, String> {
    Ok(std::path::MAIN_SEPARATOR.to_string())
}

// =============================================================================
// PATH VALIDATION FUNCTIONS
// =============================================================================

/// Validate path for read operations (file must exist)
fn validate_read_path(path: &str) -> Result<(), String> {
    // Use higher-level validators from validations.rs
    validate_platform_path(path)?;
    // For read operations, path must exist
    if !Path::new(path).exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    Ok(())
}

/// Validate path for write/create operations (allows non-existing paths)
fn validate_write_path(path: &str) -> Result<(), String> {
    // Basic structure validation only (non-empty, no null bytes)
    if path.trim().is_empty() {
        return Err("Path cannot be empty".to_string());
    }
    if path.contains('\0') {
        return Err("Path contains null bytes".to_string());
    }

    // Optionally validate parent directory
    if let Some(parent) = Path::new(path).parent() {
        validate_directory_path(&parent.to_string_lossy())?;
    }

    Ok(())
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/// Validate that a path is accessible within allowed boundaries
fn copy_dir_recursive(from: &Path, to: &Path) -> Result<(), String> {
    let entries = match fs::read_dir(from) {
        Ok(entries) => entries,
        Err(e) => return Err(format!("Failed to read directory: {}", e)),
    };

    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };

        let entry_path = entry.path();
        let file_name = entry.file_name();
        let dest_path = to.join(file_name);

        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };

        if metadata.is_dir() {
            // Recursively copy directory
            if let Err(e) = fs::create_dir_all(&dest_path) {
                return Err(format!("Failed to create directory: {}", e));
            }
            if let Err(e) = copy_dir_recursive(&entry_path, &dest_path) {
                return Err(e);
            }
        } else {
            // Copy file
            if let Err(e) = fs::copy(&entry_path, &dest_path) {
                return Err(format!("Failed to copy file: {}", e));
            }
        }
    }

    Ok(())
}