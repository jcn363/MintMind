/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use std::sync::Arc;
use tokio::sync::Mutex;
use tempfile::TempDir;
use std::time::Duration;

use crate::services::fileio::{
    service::FileIOService,
    types::{FileIORequest, WriteFileRequest, ReadFileRequest},
};

#[tokio::test]
async fn test_concurrent_writes_to_same_file() {
    let temp_dir = TempDir::new().unwrap();
    let test_file = temp_dir.path().join("concurrent.txt");

    let ipc_sink = Arc::new(|_| {});
    let service = Arc::new(Mutex::new(FileIOService::new(ipc_sink)));

    let mut handles = vec![];

    // Spawn multiple concurrent writers
    for i in 0..10 {
        let service = service.clone();
        let file_path = test_file.to_string_lossy().to_string();
        let handle = tokio::spawn(async move {
            let request = FileIORequest::WriteFile(WriteFileRequest {
                path: file_path.clone(),
                content: format!("Content from writer {}", i),
                encoding: Some("utf8".to_string()),
                create_dirs: Some(false),
                atomic: Some(crate::services::fileio::types::AtomicWriteOptions {
                    postfix: ".tmp".to_string(),
                }),
            });

            let service = service.lock().await;
            service.process_request(request).await
        });
        handles.push(handle);
    }

    // Wait for all writes to complete
    for handle in handles {
        let result = handle.await.unwrap();
        assert!(result.is_ok());
    }

    // Verify the file exists and has content (exact content depends on locking mechanism)
    assert!(test_file.exists());
    let content = std::fs::read_to_string(&test_file).unwrap();
    assert!(!content.is_empty());
}

#[tokio::test]
async fn test_concurrent_reads_from_same_file() {
    let temp_dir = TempDir::new().unwrap();
    let test_file = temp_dir.path().join("concurrent_read.txt");
    let test_content = "Concurrent read test content";
    std::fs::write(&test_file, test_content).unwrap();

    let ipc_sink = Arc::new(|_| {});
    let service = Arc::new(Mutex::new(FileIOService::new(ipc_sink)));

    let mut handles = vec![];

    // Spawn multiple concurrent readers
    for _ in 0..10 {
        let service = service.clone();
        let file_path = test_file.to_string_lossy().to_string();
        let handle = tokio::spawn(async move {
            let request = FileIORequest::ReadFile(ReadFileRequest {
                path: file_path.clone(),
                encoding: Some("utf8".to_string()),
            });

            let service = service.lock().await;
            service.process_request(request).await
        });
        handles.push(handle);
    }

    // Wait for all reads to complete and verify results
    for handle in handles {
        let result = handle.await.unwrap();
        assert!(result.is_ok());
        match result.unwrap() {
            crate::services::fileio::types::FileIOResponse::ReadFile(read_response) => {
                assert_eq!(read_response.content, test_content);
            }
            _ => panic!("Expected ReadFile response"),
        }
    }
}

#[tokio::test]
async fn test_concurrent_operations_mixed() {
    let temp_dir = TempDir::new().unwrap();
    let test_file = temp_dir.path().join("mixed_operations.txt");

    let ipc_sink = Arc::new(|_| {});
    let service = Arc::new(Mutex::new(FileIOService::new(ipc_sink)));

    let mut handles = vec![];

    // Write initial content
    {
        let service = service.clone();
        let file_path = test_file.to_string_lossy().to_string();
        let handle = tokio::spawn(async move {
            let request = FileIORequest::WriteFile(WriteFileRequest {
                path: file_path.clone(),
                content: "Initial content".to_string(),
                encoding: Some("utf8".to_string()),
                create_dirs: Some(false),
                atomic: None,
            });

            let service = service.lock().await;
            service.process_request(request).await
        });
        handles.push(handle);
    }

    // Concurrent reads and writes
    for i in 0..5 {
        // Reader
        let service = service.clone();
        let file_path = test_file.to_string_lossy().to_string();
        let handle = tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(10)).await; // Small delay
            let request = FileIORequest::ReadFile(ReadFileRequest {
                path: file_path.clone(),
                encoding: Some("utf8".to_string()),
            });

            let service = service.lock().await;
            service.process_request(request).await
        });
        handles.push(handle);

        // Writer
        let service = service.clone();
        let file_path = test_file.to_string_lossy().to_string();
        let handle = tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(5)).await; // Small delay
            let request = FileIORequest::WriteFile(WriteFileRequest {
                path: file_path.clone(),
                content: format!("Updated content {}", i),
                encoding: Some("utf8".to_string()),
                create_dirs: Some(false),
                atomic: Some(crate::services::fileio::types::AtomicWriteOptions {
                    postfix: ".tmp".to_string(),
                }),
            });

            let service = service.lock().await;
            service.process_request(request).await
        });
        handles.push(handle);
    }

    // Wait for all operations to complete
    for handle in handles {
        let result = handle.await.unwrap();
        assert!(result.is_ok());
    }

    // File should exist and have some content
    assert!(test_file.exists());
    let content = std::fs::read_to_string(&test_file).unwrap();
    assert!(!content.is_empty());
}

#[tokio::test]
async fn test_file_handle_operations_concurrent() {
    let temp_dir = TempDir::new().unwrap();
    let test_file = temp_dir.path().join("handle_test.txt");
    std::fs::write(&test_file, "Handle test").unwrap();

    let ipc_sink = Arc::new(|_| {});
    let service = Arc::new(Mutex::new(FileIOService::new(ipc_sink)));

    let mut handles = vec![];

    // Test concurrent handle operations
    for i in 0..3 {
        let service = service.clone();
        let file_path = test_file.to_string_lossy().to_string();
        let handle = tokio::spawn(async move {
            use crate::services::fileio::types::{OpenFileRequest, CloseFileRequest, FileIORequest};

            let mut results = vec![];

            // Open file
            let open_request = FileIORequest::OpenFile(OpenFileRequest {
                path: file_path.clone(),
                create: Some(false),
                unlock: None,
            });

            let service = service.lock().await;
            let open_result = service.process_request(open_request).await;
            results.push(open_result);

            if let Ok(crate::services::fileio::types::FileIOResponse::OpenFile(open_response)) = open_result {
                let handle_id = open_response.handle;

                // Close file
                let close_request = FileIORequest::CloseFile(CloseFileRequest {
                    handle: handle_id,
                });

                let close_result = service.process_request(close_request).await;
                results.push(close_result);
            }

            results
        });
        handles.push(handle);
    }

    // Wait for all handle operations to complete
    for handle in handles {
        let results = handle.await.unwrap();
        for result in results {
            assert!(result.is_ok());
        }
    }
}