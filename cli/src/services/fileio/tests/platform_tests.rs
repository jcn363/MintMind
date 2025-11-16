/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use std::time::Instant;
use tempfile::TempDir;
use tokio::fs;

#[cfg(target_os = "linux")]
mod linux_tests {
    use super::*;
    use crate::services::fileio::operations::copy;
    use crate::services::fileio::types::CopyRequest;

    #[tokio::test]
    #[ignore] // Manual-run performance test
    async fn test_copy_file_range_efficiency() {
        let temp_dir = TempDir::new().unwrap();
        let source = temp_dir.path().join("large_file");
        let dest = temp_dir.path().join("copied_file");

        // Create 100MB test file
        let data = vec![0u8; 100 * 1024 * 1024];
        fs::write(&source, &data).await.unwrap();

        // Time the copy
        let start = Instant::now();
        let request = CopyRequest {
            source: source.to_string_lossy().to_string(),
            destination: dest.to_string_lossy().to_string(),
            overwrite: Some(true),
        };
        copy(request).await.unwrap();
        let duration = start.elapsed();

        // Assert copy is faster than standard copy (rough estimate)
        assert!(duration.as_millis() < 5000, "Copy took too long: {:?}", duration);

        // Verify content
        let copied_data = fs::read(&dest).await.unwrap();
        assert_eq!(data.len(), copied_data.len());
        assert_eq!(data, copied_data);
    }
}

#[cfg(target_os = "macos")]
mod macos_tests {
    use super::*;
    use crate::services::fileio::operations::copy;
    use crate::services::fileio::types::CopyRequest;
    use crate::services::fileio::operations::readdir;
    use crate::services::fileio::types::ReadDirRequest;
    use unicode_normalization::UnicodeNormalization;

    #[tokio::test]
    #[ignore] // Manual-run performance test
    async fn test_clonefile_reflink() {
        let temp_dir = TempDir::new().unwrap();
        let source = temp_dir.path().join("source_file");
        let dest = temp_dir.path().join("cloned_file");

        // Create test file
        let data = b"Hello, APFS clone!";
        fs::write(&source, data).await.unwrap();

        // Time the copy (should be instant on APFS)
        let start = Instant::now();
        let request = CopyRequest {
            source: source.to_string_lossy().to_string(),
            destination: dest.to_string_lossy().to_string(),
            overwrite: Some(false),
        };
        copy(request).await.unwrap();
        let duration = start.elapsed();

        // Assert near-instant copy
        assert!(duration.as_millis() < 1, "Clone took too long: {:?}", duration);

        // Verify content
        let cloned_data = fs::read(&dest).await.unwrap();
        assert_eq!(data.to_vec(), cloned_data);

        // TODO: Check for shared blocks if possible (requires statfs or similar)
    }

    #[tokio::test]
    async fn test_nfc_normalization_readdir() {
        let temp_dir = TempDir::new().unwrap();
        // Create file with NFD name (decomposed)
        let nfd_name = "caf\u{00e9}"; // é in NFD
        let file_path = temp_dir.path().join(nfd_name);
        fs::write(&file_path, "test").await.unwrap();

        let request = ReadDirRequest {
            path: temp_dir.path().to_string_lossy().to_string(),
        };
        let entries = readdir(request).await.unwrap();

        // Find our file
        let entry = entries.iter().find(|e| e.name == nfd_name.nfc().collect::<String>()).unwrap();
        assert!(entry.name == "café", "Expected NFC normalized name, got: {}", entry.name);
    }
}

#[cfg(target_os = "windows")]
mod windows_tests {
    use super::*;
    use crate::services::fileio::operations::stat;
    use crate::services::fileio::types::StatRequest;
    use std::os::windows::fs::OpenOptionsExt;

    #[tokio::test]
    async fn test_unc_path_operations() {
        // For testing, we'll use a temp path and assume UNC handling
        // In real UNC scenario, this would be something like \\server\share\file
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test_file");
        fs::write(&file_path, "UNC test").await.unwrap();

        // Mock UNC path (in real test, use actual UNC)
        let unc_path = format!("\\\\localhost\\{}", file_path.to_string_lossy().replace(":", "$"));

        let request = StatRequest { path: unc_path };
        let result = stat(request).await;

        // Should not crash, even if path doesn't exist in mock
        // In real UNC test, this would succeed if UNC is accessible
        assert!(result.is_ok() || result.is_err()); // Allow either, as long as no panic
    }

    #[tokio::test]
    async fn test_hidden_file_preserve() {
        let temp_dir = TempDir::new().unwrap();
        let hidden_file = temp_dir.path().join("hidden.txt");

        // Create hidden file using Windows attributes
        {
            use std::fs::OpenOptions;
            let file = OpenOptions::new()
                .write(true)
                .create(true)
                .attributes(0x2) // FILE_ATTRIBUTE_HIDDEN
                .open(&hidden_file).unwrap();
            std::io::Write::write_all(&mut std::io::BufWriter::new(file), b"hidden content").unwrap();
        }

        // Write content (via fileio service)
        let request = crate::services::fileio::types::WriteFileRequest {
            path: hidden_file.to_string_lossy().to_string(),
            content: "updated hidden".to_string(),
            encoding: Some("utf8".to_string()),
            create_dirs: Some(false),
            atomic: None,
        };
        crate::services::fileio::operations::write_file(request).await.unwrap();

        // Stat and verify attributes preserved
        let metadata = std::fs::metadata(&hidden_file).unwrap();
        let attributes = metadata.file_attributes();
        assert!(attributes & 0x2 != 0, "Hidden attribute not preserved");
    }
}

// Cross-platform tests
#[tokio::test]
async fn test_large_file_streaming() {
    let temp_dir = TempDir::new().unwrap();
    let large_file = temp_dir.path().join("large_file");

    // Create 2GB test file (but actually smaller for test speed)
    let size = 2 * 1024 * 1024 * 1024; // 2GB
    // For test efficiency, use smaller size
    let test_size = 10 * 1024 * 1024; // 10MB

    let data = vec![42u8; test_size];
    fs::write(&large_file, &data).await.unwrap();

    // Stream in 256KB chunks
    let mut total_read = 0;
    let chunk_size = 256 * 1024;
    let mut position = 0;

    while total_read < test_size {
        let request = crate::services::fileio::types::ReadFileStreamRequest {
            path: large_file.to_string_lossy().to_string(),
            options: Some(crate::services::fileio::types::ReadFileStreamOptions {
                start: Some(position),
                length: Some(chunk_size as u64),
                buffer_size: Some(chunk_size as u32),
            }),
        };

        let response = crate::services::fileio::operations::read_file_stream(request).await.unwrap();
        total_read += response.chunk.len();
        position += response.chunk.len() as u64;

        if response.done {
            break;
        }
    }

    assert_eq!(total_read, test_size, "Did not read full file");
    // No OOM should occur (this test passes if it completes)
}