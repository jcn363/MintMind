/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use std::sync::Arc;
use tokio::sync::Mutex;
use tempfile::TempDir;

use crate::services::fileio::{
    service::FileIOService,
    types::{FileIORequest, FileIOResponse, ReadFileRequest, WriteFileRequest, StatRequest},
};

#[tokio::test]
async fn test_read_file() {
    let temp_dir = TempDir::new().unwrap();
    let test_file = temp_dir.path().join("test.txt");
    std::fs::write(&test_file, "Hello, World!").unwrap();

    let ipc_sink = Arc::new(|_| {});
    let service = FileIOService::new(ipc_sink);

    let request = FileIORequest::ReadFile(ReadFileRequest {
        path: test_file.to_string_lossy().to_string(),
        encoding: Some("utf8".to_string()),
    });

    let response = service.process_request(request).await.unwrap();

    match response {
        FileIOResponse::ReadFile(read_response) => {
            assert_eq!(read_response.content, "Hello, World!");
            assert!(read_response.stat.size > 0);
            assert!(read_response.stat.is_file);
        }
        _ => panic!("Expected ReadFile response"),
    }
}

#[tokio::test]
async fn test_write_file() {
    let temp_dir = TempDir::new().unwrap();
    let test_file = temp_dir.path().join("test_write.txt");

    let ipc_sink = Arc::new(|_| {});
    let service = FileIOService::new(ipc_sink);

    let request = FileIORequest::WriteFile(WriteFileRequest {
        path: test_file.to_string_lossy().to_string(),
        content: "Test content".to_string(),
        encoding: Some("utf8".to_string()),
        create_dirs: Some(false),
        atomic: None,
    });

    let response = service.process_request(request).await.unwrap();

    match response {
        FileIOResponse::WriteFile(()) => {
            let content = std::fs::read_to_string(&test_file).unwrap();
            assert_eq!(content, "Test content");
        }
        _ => panic!("Expected WriteFile response"),
    }
}

#[tokio::test]
async fn test_stat_file() {
    let temp_dir = TempDir::new().unwrap();
    let test_file = temp_dir.path().join("test_stat.txt");
    std::fs::write(&test_file, "stat test").unwrap();

    let ipc_sink = Arc::new(|_| {});
    let service = FileIOService::new(ipc_sink);

    let request = FileIORequest::Stat(StatRequest {
        path: test_file.to_string_lossy().to_string(),
    });

    let response = service.process_request(request).await.unwrap();

    match response {
        FileIOResponse::Stat(stat) => {
            assert!(stat.is_file);
            assert!(!stat.is_directory);
            assert_eq!(stat.size, 9); // "stat test" is 9 bytes
        }
        _ => panic!("Expected Stat response"),
    }
}

#[tokio::test]
async fn test_stat_directory() {
    let temp_dir = TempDir::new().unwrap();

    let ipc_sink = Arc::new(|_| {});
    let service = FileIOService::new(ipc_sink);

    let request = FileIORequest::Stat(StatRequest {
        path: temp_dir.path().to_string_lossy().to_string(),
    });

    let response = service.process_request(request).await.unwrap();

    match response {
        FileIOResponse::Stat(stat) => {
            assert!(!stat.is_file);
            assert!(stat.is_directory);
        }
        _ => panic!("Expected Stat response"),
    }
}

#[tokio::test]
async fn test_read_nonexistent_file() {
    let temp_dir = TempDir::new().unwrap();
    let nonexistent_file = temp_dir.path().join("nonexistent.txt");

    let ipc_sink = Arc::new(|_| {});
    let service = FileIOService::new(ipc_sink);

    let request = FileIORequest::ReadFile(ReadFileRequest {
        path: nonexistent_file.to_string_lossy().to_string(),
        encoding: Some("utf8".to_string()),
    });

    let result = service.process_request(request).await;

    assert!(result.is_err());
    let error = result.unwrap_err();
    assert!(error.to_string().contains("No such file or directory"));
}

#[tokio::test]
async fn test_write_atomic() {
    let temp_dir = TempDir::new().unwrap();
    let test_file = temp_dir.path().join("atomic_write.txt");

    let ipc_sink = Arc::new(|_| {});
    let service = FileIOService::new(ipc_sink);

    let request = FileIORequest::WriteFile(WriteFileRequest {
        path: test_file.to_string_lossy().to_string(),
        content: "Atomic content".to_string(),
        encoding: Some("utf8".to_string()),
        create_dirs: Some(false),
        atomic: Some(crate::services::fileio::types::AtomicWriteOptions {
            postfix: ".tmp".to_string(),
        }),
    });

    let response = service.process_request(request).await.unwrap();

    match response {
        FileIOResponse::WriteFile(()) => {
            let content = std::fs::read_to_string(&test_file).unwrap();
            assert_eq!(content, "Atomic content");
            // Check that temp file was cleaned up
            let temp_file = temp_dir.path().join("atomic_write.txt.tmp");
            assert!(!temp_file.exists());
        }
        _ => panic!("Expected WriteFile response"),
    }
}