/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use crate::services::fileio::types::*;
use crate::services::fileio::platform;
use crate::services::paths as paths;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64_STANDARD};
use std::collections::HashMap;
use std::ffi::OsStr;
use std::path::Path;
use std::sync::{Arc, Mutex};
use tokio::fs;
use tokio::io::AsyncReadExt;
use tokio::sync::Semaphore;

// Global state for handle management
lazy_static::lazy_static! {
    static ref HANDLE_MAP: Arc<Mutex<HashMap<u32, std::fs::File>>> = Arc::new(Mutex::new(HashMap::new()));
    static ref RESOURCE_LOCKS: Arc<Mutex<HashMap<String, Arc<Semaphore>>>> = Arc::new(Mutex::new(HashMap::new()));
    static ref NEXT_HANDLE: Arc<Mutex<u32>> = Arc::new(Mutex::new(1));
}

pub async fn read_file(request: ReadFileRequest) -> Result<ReadFileResponse, Box<dyn std::error::Error + Send + Sync>> {
    let path = paths::to_path_buf(&request.path)?;
    let encoding = request.encoding.as_deref().unwrap_or("utf8");

    let content = match encoding {
        "utf8" => fs::read_to_string(&path).await?,
        "base64" => {
            let bytes = fs::read(&path).await?;
            BASE64_STANDARD.encode(bytes)
        }
        _ => return Err(format!("Unsupported encoding: {}", encoding).into()),
    };

    let metadata = fs::metadata(&path).await?;
    let stat = FileStat {
        size: metadata.len(),
        mtime: metadata.modified()?.duration_since(std::time::UNIX_EPOCH)?.as_millis() as i64,
        ctime: metadata.created()?.duration_since(std::time::UNIX_EPOCH)?.as_millis() as i64,
        is_directory: metadata.is_dir(),
        is_file: metadata.is_file(),
        is_symlink: metadata.file_type().is_symlink(),
        permissions: 0, // TODO: Convert permissions properly
    };

    Ok(ReadFileResponse { content, stat })
}

pub async fn write_file(request: WriteFileRequest) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let path = paths::to_path_buf(&request.path)?;
    let encoding = request.encoding.as_deref().unwrap_or("utf8");
    let create_dirs = request.create_dirs.unwrap_or(false);

    if create_dirs {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).await?;
        }
    }

    let content_bytes = match encoding {
        "utf8" => request.content.into_bytes(),
        "base64" => BASE64_STANDARD.decode(&request.content)?,
        _ => return Err(format!("Unsupported encoding: {}", encoding).into()),
    };

    if let Some(atomic_opts) = &request.atomic {
        write_file_atomic(&path, &content_bytes, &atomic_opts.postfix).await?;
    } else {
        fs::write(&path, &content_bytes).await?;
    }

    Ok(())
}

pub async fn write_file_atomic(path: &Path, content: &[u8], postfix: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Stat the target path and reject atomic writes on symbolic links
    if let Ok(metadata) = std::fs::metadata(path) {
        if metadata.file_type().is_symlink() {
            return Err("Atomic writes are not supported for symbolic links".into());
        }
    }

    // Construct the temp path as a sibling in the same directory using a configurable postfix
    let mut temp_path = path.to_path_buf();
    let file_name = path.file_name().unwrap_or(OsStr::new("")).to_string_lossy();
    temp_path.set_file_name(format!("{}{}", file_name, postfix));

    // Acquire resource locks for both the target and temp resources while writing and renaming
    let target_key = path.to_string_lossy().to_string();
    let temp_key = temp_path.to_string_lossy().to_string();

    let target_lock = acquire_resource_lock(&target_key).await;
    let temp_lock = acquire_resource_lock(&temp_key).await;

    let _target_guard = target_lock.acquire().await.unwrap();
    let _temp_guard = temp_lock.acquire().await.unwrap();

    // Write to temp file
    fs::write(&temp_path, content).await?;

    // After writing to the temp file, flush it to disk with sync_data/fdatasync equivalents
    {
        let temp_file = std::fs::OpenOptions::new()
            .write(true)
            .open(&temp_path)?;
        temp_file.sync_data()?;
    }

    // Rename over target
    match fs::rename(&temp_path, path).await {
        Ok(()) => Ok(()),
        Err(e) => {
            // On rename failure, attempt to remove the temp file, ignoring errors so the original error bubbles up
            let _ = fs::remove_file(&temp_path).await;
            Err(e.into())
        }
    }
}

async fn acquire_resource_lock(key: &str) -> Arc<Semaphore> {
    let mut locks = RESOURCE_LOCKS.lock().unwrap();
    locks.entry(key.to_string()).or_insert_with(|| Arc::new(Semaphore::new(1))).clone()
}

pub async fn copy(request: CopyRequest) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let source = paths::to_path_buf(&request.source)?;
    let destination = paths::to_path_buf(&request.destination)?;
    let overwrite = request.overwrite.unwrap_or(false);

    // Validate copy operation similar to TS provider
    if source == destination {
        return Ok(()); // No-op if same path
    }

    if destination.exists() && !overwrite {
        return Err("Destination already exists".into());
    }

    // Handle symlinks properly (TS provider supports symlink preservation)
    platform::copy_file(&source, &destination).await?;
    Ok(())
}

pub async fn delete(request: DeleteRequest) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let path = paths::to_path_buf(&request.path)?;
    let recursive = request.recursive.unwrap_or(false);
    let atomic = request.atomic.unwrap_or(false);

    if atomic && recursive {
        // For atomic recursive delete, use platform-specific implementation
        // For now, fall back to regular recursive delete
        fs::remove_dir_all(&path).await?;
    } else if recursive {
        fs::remove_dir_all(&path).await?;
    } else {
        let metadata = fs::metadata(&path).await?;
        if metadata.is_dir() {
            fs::remove_dir(&path).await?;
        } else {
            fs::remove_file(&path).await?;
        }
    }

    Ok(())
}

pub async fn stat(request: StatRequest) -> Result<FileStat, Box<dyn std::error::Error + Send + Sync>> {
    let path = paths::to_path_buf(&request.path)?;
    let metadata = fs::metadata(&path).await?;

    Ok(FileStat {
        size: metadata.len(),
        mtime: metadata.modified()?.duration_since(std::time::UNIX_EPOCH)?.as_millis() as i64,
        ctime: metadata.created()?.duration_since(std::time::UNIX_EPOCH)?.as_millis() as i64,
        is_directory: metadata.is_dir(),
        is_file: metadata.is_file(),
        is_symlink: metadata.file_type().is_symlink(),
        permissions: 0, // TODO: Convert permissions properly
    })
}

pub async fn readdir(request: ReadDirRequest) -> Result<Vec<DirEntry>, Box<dyn std::error::Error + Send + Sync>> {
    let path = paths::to_path_buf(&request.path)?;
    let mut entries = Vec::new();

    let mut dir_entries = fs::read_dir(&path).await?;
    while let Some(entry) = dir_entries.next_entry().await? {
        let metadata = entry.metadata().await?;
        let name = entry.file_name().to_string_lossy().to_string();
        let entry_path = entry.path().to_string_lossy().to_string();

        entries.push(DirEntry {
            name,
            path: entry_path,
            is_directory: metadata.is_dir(),
            is_file: metadata.is_file(),
            is_symlink: metadata.file_type().is_symlink(),
            size: Some(metadata.len()),
            mtime: Some(metadata.modified()?.duration_since(std::time::UNIX_EPOCH)?.as_millis() as i64),
        });
    }

    Ok(entries)
}

pub async fn realpath(request: RealPathRequest) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    let path = paths::to_path_buf(&request.path)?;
    let canonical = fs::canonicalize(&path).await?;
    Ok(canonical.to_string_lossy().to_string())
}

pub async fn mkdir(request: MkDirRequest) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let path = paths::to_path_buf(&request.path)?;
    let recursive = request.recursive.unwrap_or(false);

    if recursive {
        fs::create_dir_all(&path).await?;
    } else {
        fs::create_dir(&path).await?;
    }

    Ok(())
}

pub async fn rename(request: RenameRequest) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let old_path = paths::to_path_buf(&request.old_path)?;
    let new_path = paths::to_path_buf(&request.new_path)?;

    fs::rename(&old_path, &new_path).await?;
    Ok(())
}

pub async fn open_file(request: OpenFileRequest) -> Result<OpenFileResponse, Box<dyn std::error::Error + Send + Sync>> {
    let path = paths::to_path_buf(&request.path)?;
    let create = request.create.unwrap_or(true);
    let unlock = request.unlock.unwrap_or(false);

    // Check if file exists for validation (similar to TS provider)
    let exists = path.exists();
    if !create && !exists {
        return Err("File does not exist".into());
    }

    // Handle unlock option similar to TS provider
    if unlock && exists {
        // Try to make file writable if it's locked
        if let Ok(metadata) = std::fs::metadata(&path) {
            let mut permissions = metadata.permissions();
            permissions.set_readonly(false);
            std::fs::set_permissions(&path, permissions)?;
        }
    }

    // Open with options matching TS provider behavior
    let file = std::fs::OpenOptions::new()
        .read(true)
        .write(create)  // Only write if creating
        .create(create)
        .truncate(create)  // Truncate when creating/writing
        .open(&path)?;

    let mut next_handle = NEXT_HANDLE.lock().unwrap();
    let handle = *next_handle;
    *next_handle += 1;

    HANDLE_MAP.lock().unwrap().insert(handle, file);

    Ok(OpenFileResponse { handle })
}

pub async fn close_file(request: CloseFileRequest) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mut handle_map = HANDLE_MAP.lock().unwrap();
    if let Some(_file) = handle_map.remove(&request.handle) {
        // File is automatically closed when dropped
        Ok(())
    } else {
        Err("Invalid handle".into())
    }
}

pub async fn read_file_handle(request: ReadFileHandleRequest) -> Result<ReadFileHandleResponse, Box<dyn std::error::Error + Send + Sync>> {
    let handle_map = HANDLE_MAP.lock().unwrap();
    if let Some(file) = handle_map.get(&request.handle) {
        let mut data = vec![0; request.length as usize];
        let bytes_read = std::io::Read::read(&mut std::io::BufReader::new(file), &mut data)?;
        data.truncate(bytes_read);
        Ok(ReadFileHandleResponse { data, bytes_read: bytes_read as u32 })
    } else {
        Err("Invalid handle".into())
    }
}

pub async fn write_file_handle(request: WriteFileHandleRequest) -> Result<WriteFileHandleResponse, Box<dyn std::error::Error + Send + Sync>> {
    let handle_map = HANDLE_MAP.lock().unwrap();
    if let Some(file) = handle_map.get(&request.handle) {
        let data_slice = &request.data[request.offset as usize..(request.offset + request.length) as usize];
        let bytes_written = std::io::Write::write(&mut std::io::BufWriter::new(file), data_slice)?;
        Ok(WriteFileHandleResponse { bytes_written: bytes_written as u32 })
    } else {
        Err("Invalid handle".into())
    }
}

pub async fn read_file_stream(request: ReadFileStreamRequest) -> Result<ReadFileStreamResponse, Box<dyn std::error::Error + Send + Sync>> {
    let path = paths::to_path_buf(&request.path)?;
    let buffer_size = request.options.as_ref().and_then(|o| o.buffer_size).unwrap_or(256 * 1024) as usize;

    let mut file = fs::File::open(&path).await?;
    let mut buffer = vec![0; buffer_size];

    let bytes_read = file.read(&mut buffer).await?;
    buffer.truncate(bytes_read);

    let done = bytes_read == 0;

    Ok(ReadFileStreamResponse { chunk: buffer, done })
}

pub async fn clone_file(request: CloneRequest) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let source = paths::to_path_buf(&request.source)?;
    let destination = paths::to_path_buf(&request.destination)?;

    // Validate that source and destination are different (similar to TS provider)
    if source == destination {
        return Ok(()); // No-op if same file, matching TS behavior
    }

    // Check if destination exists and handle accordingly (TS provider validates this)
    if destination.exists() {
        return Err("Destination already exists".into());
    }

    fs::copy(&source, &destination).await?;
    Ok(())
}