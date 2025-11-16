/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use std::path::Path;
use tokio::fs;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

#[cfg(target_os = "linux")]
mod linux {
    use super::*;
    use std::os::unix::io::AsRawFd;

    pub async fn copy_file(source: &Path, destination: &Path) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let source_metadata = std::fs::metadata(source)?;
        let total_size = source_metadata.len();

        let source_file = std::fs::File::open(source)?;
        let dest_file = std::fs::File::create(destination)?;

        if total_size == 0 {
            std::fs::set_permissions(destination, source_metadata.permissions())?;
            return Ok(());
        }

        // Try copy_file_range with loop
        let mut copied = 0u64;
        let mut offset_in = 0i64;
        let mut offset_out = 0i64;
        let mut use_sendfile = false;

        while copied < total_size {
            let remaining = (total_size - copied) as usize;
            unsafe {
                let result = libc::copy_file_range(
                    source_file.as_raw_fd(),
                    &mut offset_in,
                    dest_file.as_raw_fd(),
                    &mut offset_out,
                    remaining,
                    0,
                );
                if result > 0 {
                    copied += result as u64;
                    offset_in += result as i64;
                    offset_out += result as i64;
                } else if result == 0 {
                    break;
                } else {
                    let errno = *libc::__errno_location();
                    if errno == libc::EINVAL || errno == libc::ENOSYS || errno == libc::EXDEV {
                        use_sendfile = true;
                        break;
                    } else if errno == libc::EAGAIN || errno == libc::EINTR {
                        continue;
                    } else {
                        break;
                    }
                }
            }
        }

        if copied == total_size {
            std::fs::set_permissions(destination, source_metadata.permissions())?;
            return Ok(());
        }

        if use_sendfile {
            // Reset destination file for sendfile
            dest_file.set_len(0)?;
            copied = 0;
            let mut offset = 0i64;

            while copied < total_size {
                let remaining = (total_size - copied) as usize;
                unsafe {
                    let result = libc::sendfile(
                        dest_file.as_raw_fd(),
                        source_file.as_raw_fd(),
                        &mut offset,
                        remaining,
                    );
                    if result > 0 {
                        copied += result as u64;
                    } else if result == 0 {
                        break;
                    } else {
                        let errno = *libc::__errno_location();
                        if errno == libc::EAGAIN || errno == libc::EINTR {
                            continue;
                        } else {
                            break;
                        }
                    }
                }
            }

            if copied == total_size {
                std::fs::set_permissions(destination, source_metadata.permissions())?;
                return Ok(());
            }
        }

        // Final fallback to tokio::fs::copy
        drop(source_file);
        drop(dest_file);
        fs::copy(source, destination).await?;
        std::fs::set_permissions(destination, source_metadata.permissions())?;
        Ok(())
    }
}

#[cfg(target_os = "macos")]
mod macos {
    use super::*;

    pub async fn copy_file(source: &Path, destination: &Path) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Try clonefile first (macOS 10.12+)
        use std::ffi::CString;
        let source_c = CString::new(source.to_string_lossy().as_bytes())?;
        let dest_c = CString::new(destination.to_string_lossy().as_bytes())?;

        unsafe {
            if libc::clonefile(source_c.as_ptr(), dest_c.as_ptr(), 0) == 0 {
                return Ok(());
            }
        }

        // Fallback to tokio::fs::copy
        fs::copy(source, destination).await?;
        Ok(())
    }

    pub fn normalize_path(path: &Path) -> String {
        use std::ffi::OsString;
        use std::os::unix::ffi::OsStringExt;
        let os_str = path.as_os_str();
        let bytes = os_str.as_bytes();
        let normalized: String = String::from_utf8_lossy(bytes).nfc().collect();
        normalized
    }
}

#[cfg(target_os = "windows")]
mod windows {
    use super::*;

    pub async fn copy_file(source: &Path, destination: &Path) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // On Windows, just use tokio::fs::copy for now
        // Future: could implement CopyFileEx or other Windows-specific optimizations
        fs::copy(source, destination).await?;
        Ok(())
    }

    pub fn normalize_unc_path(path: &str) -> String {
        // Handle UNC paths if needed
        path.to_string()
    }
}

#[cfg(target_os = "linux")]
pub use linux::copy_file;

#[cfg(target_os = "macos")]
pub use macos::copy_file;

#[cfg(target_os = "windows")]
pub use windows::copy_file;

// Fallback for unsupported platforms
#[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
pub async fn copy_file(source: &Path, destination: &Path) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    fs::copy(source, destination).await?;
    Ok(())
}

pub async fn optimized_read_file(path: &Path) -> Result<Vec<u8>, Box<dyn std::error::Error + Send + Sync>> {
    // Platform-specific optimizations for reading files
    // For now, just use standard tokio::fs::read
    fs::read(path).await.map_err(Into::into)
}

pub async fn optimized_write_file(path: &Path, data: &[u8]) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Platform-specific optimizations for writing files
    // For now, just use standard tokio::fs::write
    fs::write(path, data).await.map_err(Into::into)
}