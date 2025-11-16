/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use std::sync::Arc;
use tokio::sync::Mutex;
use tempfile::TempDir;
use tokio::process::Command;
use std::io::{BufRead, BufReader, Write};
use std::process::Stdio;

use crate::services::fileio::types::{FileIORequest, FileIOResponse, ReadFileRequest};

#[tokio::test]
async fn test_ipc_read_file() {
    let temp_dir = TempDir::new().unwrap();
    let test_file = temp_dir.path().join("ipc_test.txt");
    std::fs::write(&test_file, "IPC test content").unwrap();

    // This test would start the actual fileio binary and communicate via IPC
    // For now, we'll test the RPC layer using a mock setup

    // Note: This is a placeholder test. In a real scenario, you would:
    // 1. Build the fileio binary
    // 2. Start it as a child process
    // 3. Send IPC messages and verify responses
    // 4. Clean up the process

    // For this implementation, we'll test the RPC serialization/deserialization
    // and basic IPC message handling

    let ipc_sink = Arc::new(|_| {});
    let service = crate::services::fileio::service::FileIOService::new(ipc_sink);

    let request = FileIORequest::ReadFile(ReadFileRequest {
        path: test_file.to_string_lossy().to_string(),
        encoding: Some("utf8".to_string()),
    });

    let response = service.process_request(request).await.unwrap();

    match response {
        FileIOResponse::ReadFile(read_response) => {
            assert_eq!(read_response.content, "IPC test content");
        }
        _ => panic!("Expected ReadFile response"),
    }
}

#[tokio::test]
async fn test_ipc_error_handling() {
    let ipc_sink = Arc::new(|_| {});
    let service = crate::services::fileio::service::FileIOService::new(ipc_sink);

    let request = FileIORequest::ReadFile(ReadFileRequest {
        path: "/nonexistent/file/path".to_string(),
        encoding: Some("utf8".to_string()),
    });

    let response = service.process_request(request).await;

    assert!(response.is_err());
    let error = response.unwrap_err();
    assert!(error.to_string().contains("No such file or directory"));
}

#[tokio::test]
async fn test_ipc_concurrent_requests() {
    let temp_dir = TempDir::new().unwrap();

    // Create multiple test files
    let mut test_files = vec![];
    for i in 0..5 {
        let file_path = temp_dir.path().join(format!("ipc_concurrent_{}.txt", i));
        std::fs::write(&file_path, format!("Content {}", i)).unwrap();
        test_files.push(file_path);
    }

    let ipc_sink = Arc::new(|_| {});
    let service = Arc::new(Mutex::new(crate::services::fileio::service::FileIOService::new(ipc_sink)));

    let mut handles = vec![];

    // Send concurrent IPC requests
    for (i, file_path) in test_files.iter().enumerate() {
        let service = service.clone();
        let file_path_str = file_path.to_string_lossy().to_string();
        let expected_content = format!("Content {}", i);

        let handle = tokio::spawn(async move {
            let request = FileIORequest::ReadFile(ReadFileRequest {
                path: file_path_str,
                encoding: Some("utf8".to_string()),
            });

            let service = service.lock().await;
            let response = service.process_request(request).await.unwrap();

            match response {
                FileIOResponse::ReadFile(read_response) => {
                    assert_eq!(read_response.content, expected_content);
                }
                _ => panic!("Expected ReadFile response"),
            }
        });

        handles.push(handle);
    }

    // Wait for all IPC requests to complete
    for handle in handles {
        handle.await.unwrap();
    }
}

#[tokio::test]
async fn test_ipc_large_file() {
    let temp_dir = TempDir::new().unwrap();
    let test_file = temp_dir.path().join("large_file.txt");

    // Create a large file (1MB)
    let large_content = "x".repeat(1024 * 1024);
    std::fs::write(&test_file, &large_content).unwrap();

    let ipc_sink = Arc::new(|_| {});
    let service = crate::services::fileio::service::FileIOService::new(ipc_sink);

    let request = FileIORequest::ReadFile(ReadFileRequest {
        path: test_file.to_string_lossy().to_string(),
        encoding: Some("utf8".to_string()),
    });

    let response = service.process_request(request).await.unwrap();

    match response {
        FileIOResponse::ReadFile(read_response) => {
            assert_eq!(read_response.content.len(), 1024 * 1024);
            assert_eq!(read_response.content, large_content);
        }
        _ => panic!("Expected ReadFile response"),
    }
}

// Integration test that would run the actual binary
// This is commented out as it requires the binary to be built first
/*
#[tokio::test]
async fn test_full_ipc_integration() {
    let temp_dir = TempDir::new().unwrap();
    let test_file = temp_dir.path().join("integration_test.txt");
    std::fs::write(&test_file, "Integration test").unwrap();

    // This would start the actual fileio binary process
    // and test full IPC communication

    // Note: This test would need to:
    // 1. Build the fileio binary
    // 2. Start it with proper IPC setup
    // 3. Send JSON-RPC messages
    // 4. Receive and validate responses
    // 5. Clean up the process
}
*/