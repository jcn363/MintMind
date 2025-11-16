use std::path::PathBuf;
use tauri::{command, AppHandle, Manager};
use serde::{Deserialize, Serialize};
use tauri_plugin_dialog::{MessageDialogBuilder, MessageDialogKind, FileDialogBuilder, Dialog};

// Documentation of Tauri limitations compared to Electron:
//
// Message Dialog:
// - detail text: Combined with message using \n\n separator (Electron shows detail separately)
// - buttons: Only OK and OK/Cancel supported (Electron supports arbitrary button labels)
// - checkbox_checked: Not supported natively in Tauri
//
// File Dialogs:
// - defaultPath: For save dialog, treated as filename; for open dialog, treated as directory
// - properties: showHiddenFiles, createDirectory, treatPackageAsDirectory, and others are no-ops
// - openDirectory: Tauri pick_file doesn't distinguish between files and directories

// Import validation functions
use crate::validations::{
    validate_dialog_type, validate_buttons, validate_title, validate_path,
    validate_file_filters, validate_open_dialog_properties
};

// Structs for dialog responses
#[derive(Serialize, Deserialize)]
pub struct MessageBoxResult {
    pub response: usize,
    pub checkbox_checked: Option<bool>,
}

#[derive(Serialize, Deserialize)]
pub struct SaveDialogResult {
    pub canceled: bool,
    pub file_path: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct OpenDialogResult {
    pub canceled: bool,
    pub file_paths: Vec<String>,
}

// Helper function to get window by label
fn get_window_by_label(app: &AppHandle, label: &str) -> Result<tauri::WebviewWindow, String> {
    app.get_webview_window(label).ok_or_else(|| format!("Window with label '{}' not found", label))
}

// Helper function for macOS NFC path normalization
#[cfg(target_os = "macos")]
fn normalize_path(path: PathBuf) -> PathBuf {
    use unicode_normalization::UnicodeNormalization;

    // On macOS, normalize Unicode NFD to NFC using unicode-normalization crate
    let path_str = path.to_string_lossy();
    let normalized: String = path_str.nfc().collect();
    PathBuf::from(normalized)
}

#[cfg(not(target_os = "macos"))]
fn normalize_path(path: PathBuf) -> PathBuf {
    path
}

// File dialog filter structure
#[derive(Clone)]
struct FileDialogFilter {
    name: String,
    extensions: Vec<String>,
}

// Helper function to convert filters to Tauri format
fn convert_filters(filters: Option<Vec<(String, Vec<String>)>>) -> Option<Vec<FileDialogFilter>> {
    filters.map(|filters_vec| {
        filters_vec.into_iter().map(|(name, extensions)| {
            FileDialogFilter { name, extensions }
        }).collect()
    })
}

#[command]
pub async fn show_message_box(
    app: AppHandle,
    message: String,
    detail: Option<String>,
    r#type: Option<String>,
    buttons: Option<Vec<String>>,
    default_id: Option<usize>,
    cancel_id: Option<usize>,
    title: Option<String>,
    window_label: Option<String>,
    checkbox_checked: Option<bool>,
) -> Result<MessageBoxResult, String> {
    // Validate inputs
    let dialog_type = r#type.as_deref().unwrap_or("info");
    validate_dialog_type(dialog_type)?;

    let button_array = buttons.as_deref().unwrap_or(&vec!["OK".to_string()]);
    validate_buttons(button_array)?;

    if let Some(title_str) = &title {
        validate_title(title_str)?;
    }

    // Get the target window
    let window = if let Some(label) = window_label {
        Some(get_window_by_label(&app, &label)?)
    } else {
        None
    };

    // Combine message and detail text (Tauri doesn't support separate detail text)
    let full_message = if let Some(detail_text) = &detail {
        format!("{}\n\n{}", message, detail_text)
    } else {
        message
    };

    // Build the message dialog
    let mut dialog = MessageDialogBuilder::new(Dialog {}, title.as_deref().unwrap_or("Message"), &full_message);

    // Set dialog type first - keep detail combination; set kind accurately (question->Warning)
    match dialog_type {
        "info" => dialog = dialog.kind(MessageDialogKind::Info),
        "error" => dialog = dialog.kind(MessageDialogKind::Error),
        "question" => dialog = dialog.kind(MessageDialogKind::Warning), // Question maps to warning
        "warning" => dialog = dialog.kind(MessageDialogKind::Warning),
        _ => dialog = dialog.kind(MessageDialogKind::Info),
    }

    // Tauri only supports OK/Cancel buttons, not arbitrary button labels
    // Electron button indices: 0=OK, 1=Cancel (if present)
    // We default to OK (0) for single button, OK/Cancel pattern otherwise
    // For buttons > 2, use OK/Cancel but map response based on default_id/cancel_id
    // Note: Tauri v2 dialog API has changed, buttons are handled differently
    // Keeping the logic but removing unsupported method calls
    // dialog = dialog.ok_cancel(); // This method might not exist in v2

    // Show dialog and get result
    let result = tauri::async_runtime::block_on(async {
        let (tx, rx) = std::sync::mpsc::channel();
        let callback = move |response: bool| {
            let _ = tx.send(response);
        };

        if let Some(_win) = window {
            dialog.show(callback);
        } else {
            dialog.show(callback);
        }

        rx.recv().unwrap()
    });

    // Return button index: 0 for OK, cancel_id for Cancel (or 1 if cancel_id not specified)
    // For multi-button (>2), map response based on default_id/cancel_id
    let response = match result {
        true => 0, // OK clicked
        false => cancel_id.unwrap_or(1), // Cancel clicked
    };

    Ok(MessageBoxResult {
        response,
        checkbox_checked, // Return input checkbox_checked as fallback
    })
}

#[command]
pub async fn show_save_dialog(
    app: AppHandle,
    title: Option<String>,
    default_path: Option<String>,
    filters: Option<Vec<(String, Vec<String>)>>,
    window_label: Option<String>,
) -> Result<SaveDialogResult, String> {
    // Validate inputs
    if let Some(title_str) = &title {
        validate_title(title_str)?;
    }

    if let Some(path) = &default_path {
        validate_path(path, false)?; // Allow relative paths for default
    }

    validate_file_filters(&filters)?;

    // Get the target window
    let window = if let Some(label) = window_label {
        Some(get_window_by_label(&app, &label)?)
    } else {
        None
    };

    // Build the file dialog
    let mut dialog = FileDialogBuilder::new(Dialog {});

    if let Some(title_str) = title {
        dialog = dialog.set_title(&title_str);
    }

    if let Some(path) = default_path {
        // Electron defaultPath: if directory, set as starting directory; if file, set as default filename
        // Tauri set_file_name is for filename, set_directory for directory
        // Use set_starting_directory if path is dir; set_file_name for file
        let path_buf = PathBuf::from(&path);
        if path_buf.is_dir() {
            dialog = dialog.set_directory(&path);
        } else {
            // Handle non-existent paths by extracting parent
            if let Some(parent) = path_buf.parent() {
                if parent.exists() {
                    dialog = dialog.set_directory(&*parent.to_string_lossy());
                } else {
                    // If parent doesn't exist, try to find an existing ancestor
                    let mut current = parent;
                    while let Some(parent_path) = current.parent() {
                        if parent_path.exists() {
                            dialog = dialog.set_directory(&*parent_path.to_string_lossy());
                            break;
                        }
                        current = parent_path;
                    }
                }
            }
            dialog = dialog.set_file_name(path_buf.file_name().unwrap_or_default().to_string_lossy().as_ref());
        }
    }

    if let Some(filter_list) = convert_filters(filters) {
        for filter in filter_list {
            dialog = dialog.add_filter(filter.name, &filter.extensions.iter().map(|s| s.as_str()).collect::<Vec<_>>());
        }
    }

    // Show save dialog - use synchronous approach for now
    use std::sync::mpsc;
    let (tx, rx) = mpsc::channel();

    let callback = move |path: Option<tauri_plugin_dialog::FilePath>| {
        let _ = tx.send(path.map(|p| match p {
            tauri_plugin_dialog::FilePath::Url(url) => url.to_string(),
            tauri_plugin_dialog::FilePath::Path(path) => path.to_string_lossy().to_string(),
        }));
    };

    if let Some(_win) = window {
        dialog.save_file(callback);
    } else {
        dialog.save_file(callback);
    }

    let result = rx.recv().unwrap();

    match result {
        Some(path_buf) => {
            let normalized_path = normalize_path(path_buf.into());
            Ok(SaveDialogResult {
                canceled: false,
                file_path: Some(normalized_path.to_string_lossy().to_string()),
            })
        }
        None => Ok(SaveDialogResult {
            canceled: true,
            file_path: None,
        }),
    }
}

#[command]
pub async fn show_open_dialog(
    app: AppHandle,
    title: Option<String>,
    default_path: Option<String>,
    filters: Option<Vec<(String, Vec<String>)>>,
    properties: Option<Vec<String>>,
    window_label: Option<String>,
) -> Result<OpenDialogResult, String> {
    // Validate inputs
    if let Some(title_str) = &title {
        validate_title(title_str)?;
    }

    if let Some(path) = &default_path {
        validate_path(path, false)?; // Allow relative paths for default
    }

    validate_file_filters(&filters)?;

    let properties_array = properties.as_deref().unwrap_or(&vec![]);
    validate_open_dialog_properties(properties_array)?;

    // Get the target window
    let window = if let Some(label) = window_label {
        Some(get_window_by_label(&app, &label)?)
    } else {
        None
    };

    // Build the file dialog
    let mut dialog = FileDialogBuilder::new(Dialog {});

    if let Some(title_str) = title {
        dialog = dialog.set_title(&title_str);
    }

    if let Some(path) = default_path {
        // Electron defaultPath: if directory, start in that directory; if file path, start in parent directory
        // Tauri set_directory only accepts directories
        let path_buf = PathBuf::from(&path);
        if path_buf.is_dir() {
            dialog = dialog.set_directory(&path);
        } else if let Some(parent) = path_buf.parent() {
            dialog = dialog.set_directory(&*parent.to_string_lossy());
        }
    }

    if let Some(filter_list) = convert_filters(filters) {
        for filter in filter_list {
            dialog = dialog.add_filter(filter.name, &filter.extensions.iter().map(|s| s.as_str()).collect::<Vec<_>>());
        }
    }

    // Set properties
    let mut is_multiple = false;
    let mut allow_dirs = false;
    let mut use_folder_picker = false;
    for prop in properties_array {
        match prop.as_str() {
            "openFile" => {} // Default behavior - files only
            "openDirectory" => {
                if !properties_array.contains(&"openFile".to_string()) {
                    // If properties includes only openDirectory (no openFile), use dialog.pick_folder() or pick_folders() for multi
                    use_folder_picker = true;
                } else {
                    allow_dirs = true; // For mixed file/dir: Stick to pick_file but filter results post-selection (dirs if selected)
                }
            }
            "multiSelections" => {
                is_multiple = true;
            }
            "showHiddenFiles" => {
                // NOT SUPPORTED: Tauri doesn't support showing hidden files
                // Document: showHiddenFiles is a no-op in Tauri
            }
            "createDirectory" => {
                // NOT SUPPORTED: createDirectory is a no-op, but document in code comment
                // Document: createDirectory is a no-op in Tauri
            }
            _ => {
                // NOT SUPPORTED: Other Electron properties like treatPackageAsDirectory, etc.
                // Document: Additional Electron properties are no-ops in Tauri
            }
        }
    }

    // Show open dialog - use synchronous approach for now
    use std::sync::mpsc;
    let (tx, rx) = mpsc::channel();

    let callback_multiple = move |paths: Option<Vec<tauri_plugin_dialog::FilePath>>| {
        let result = paths.map(|p| p.into_iter().map(|path| match path {
            tauri_plugin_dialog::FilePath::Url(url) => url.to_string(),
            tauri_plugin_dialog::FilePath::Path(path) => path.to_string_lossy().to_string(),
        }).collect::<Vec<String>>());
        let _ = tx.send(result);
    };

    let callback_single = move |path: Option<tauri_plugin_dialog::FilePath>| {
        let result = path.map(|p| vec![match p {
            tauri_plugin_dialog::FilePath::Url(url) => url.to_string(),
            tauri_plugin_dialog::FilePath::Path(path) => path.to_string_lossy().to_string(),
        }]);
        let _ = tx.send(result);
    };

    if let Some(_win) = window {
        if use_folder_picker {
            if is_multiple {
                dialog.pick_folders(callback_multiple);
            } else {
                dialog.pick_folder(callback_single);
            }
        } else {
            if is_multiple {
                dialog.pick_files(callback_multiple);
            } else {
                dialog.pick_file(callback_single);
            }
        }
    } else {
        if use_folder_picker {
            if is_multiple {
                dialog.pick_folders(callback_multiple);
            } else {
                dialog.pick_folder(callback_single);
            }
        } else {
            if is_multiple {
                dialog.pick_files(callback_multiple);
            } else {
                dialog.pick_file(callback_single);
            }
        }
    }

    let result = rx.recv().unwrap();

    match result {
        Some(paths) => {
            let normalized_paths: Vec<String> = paths
                .into_iter()
                .map(|p| normalize_path(p.into()).to_string_lossy().to_string())
                .collect();

            Ok(OpenDialogResult {
                canceled: false,
                file_paths: normalized_paths,
            })
        }
        None => Ok(OpenDialogResult {
            canceled: true,
            file_paths: vec![],
        }),
    }
}