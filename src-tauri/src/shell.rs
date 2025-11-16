use tauri::{AppHandle, command};
use std::process::Command;
use std::env;
use std::path::Path;

use crate::validations::{validate_path, validate_url};

#[command]
pub fn show_item_in_folder(app: AppHandle, path: String) -> Result<(), String> {
    println!("show_item_in_folder: {}", path);
    validate_path(&path, false)?;

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        let parent = Path::new(&path).parent()
            .ok_or("No parent directory found")?;
        Command::new("xdg-open")
            .arg(parent)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    Ok(())
}

#[command]
pub fn open_external(app: AppHandle, url: String) -> Result<(), String> {
    println!("open_external: {}", url);
    validate_url(&url)?;

    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/c", "start", &url])
            .spawn()
            .map_err(|e| format!("Failed to open external: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Failed to open external: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Failed to open external: {}", e))?;
    }

    Ok(())
}

#[command]
pub fn move_item_to_trash(app: AppHandle, path: String) -> Result<(), String> {
    println!("move_item_to_trash: {}", path);
    validate_path(&path, false)?;

    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/c", "del", "/q", &path])
            .spawn()
            .map_err(|e| format!("Failed to move to trash: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("osascript")
            .args(["-e", &format!("tell application \"Finder\" to delete POSIX file \"{}\"", path)])
            .spawn()
            .map_err(|e| format!("Failed to move to trash: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("gio")
            .args(["trash", &path])
            .spawn()
            .map_err(|e| format!("Failed to move to trash: {}", e))?;
    }

    Ok(())
}