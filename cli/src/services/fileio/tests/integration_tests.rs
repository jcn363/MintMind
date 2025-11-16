/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use std::io::Write;
use std::process::Stdio;
use tempfile::TempDir;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, BufReader};
use tokio::process::Command;

use crate::services::fileio::types::{FileIORequest, FileIOResponse, ReadFileRequest, WriteFileRequest, AtomicWriteOptions};

#[derive(Clone)]
struct ChildProcess {
    child: tokio::process::Child,
}

impl ChildProcess {
    async fn new() -> Self {
        let child = Command::new("./target/debug/fileio")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .expect("Failed to spawn fileio process");

        Self { child }
    }

    fn stdin(&mut self) -> &mut tokio::process::ChildStdin {
        self.child.stdin.as_mut().expect("Failed to get stdin")
    }

    fn stdout(&mut self) -> BufReader<&mut tokio::process::ChildStdout> {
        let stdout = self.child.stdout.as_mut().expect("Failed to get stdout");
        BufReader::new(stdout)
    }

    async fn send_request(&mut self, request: &serde_json::Value) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
        let request_str = serde_json::to_string(request)? + "\n";
        self.stdin().write_all(request_str.as_bytes()).await?;
        self.stdin().flush().await?;

        let mut response_line = String::new();
        self.stdout().read_line(&mut response_line).await?;
        let response: serde_json::Value = serde_json::from_str(&response_line.trim())?;
        Ok(response)
    }
}

impl Drop for ChildProcess {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

#[tokio::test]
async fn test_full_read_write_cycle() {
    let temp_dir = TempDir::new().unwrap();
    let test_file = temp_dir.path().join("test_read_write.txt");
    let content = "Test content for read/write cycle";

    let mut process = ChildProcess::new().await;

    // Write file
    let write_request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "onFileIORequest",
        "params": {
            "method": "WriteFile",
            "params": {
                "path": test_file.to_string_lossy(),
                "content": content,
                "encoding": "utf8"
            }
        }
    });

    let write_response = process.send_request(&write_request).await.unwrap();
    assert!(write_response["result"].is_null() || write_response["error"].is_null());

    // Read file
    let read_request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 2,
        "method": "onFileIORequest",
        "params": {
            "method": "ReadFile",
            "params": {
                "path": test_file.to_string_lossy(),
                "encoding": "utf8"
            }
        }
    });

    let read_response = process.send_request(&read_request).await.unwrap();
    assert_eq!(read_response["result"]["content"], content);
}

#[tokio::test]
async fn test_atomic_write() {
    let temp_dir = TempDir::new().unwrap();
    let test_file = temp_dir.path().join("test_atomic.txt");
    let content = "Atomic write content";

    let mut process = ChildProcess::new().await;

    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "onFileIORequest",
        "params": {
            "method": "WriteFile",
            "params": {
                "path": test_file.to_string_lossy(),
                "content": content,
                "encoding": "utf8",
                "atomic": {
                    "postfix": ".tmp"
                }
            }
        }
    });

    process.send_request(&request).await.unwrap();

    // Verify no temp file left behind
    let temp_file = temp_dir.path().join("test_atomic.txt.tmp");
    assert!(!temp_file.exists());

    // Verify content was written
    let read_request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 2,
        "method": "onFileIORequest",
        "params": {
            "method": "ReadFile",
            "params": {
                "path": test_file.to_string_lossy(),
                "encoding": "utf8"
            }
        }
    });

    let read_response = process.send_request(&read_request).await.unwrap();
    assert_eq!(read_response["result"]["content"], content);
}

#[tokio::test]
async fn test_error_propagation() {
    let mut process = ChildProcess::new().await;

    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "onFileIORequest",
        "params": {
            "method": "ReadFile",
            "params": {
                "path": "/nonexistent/path/file.txt",
                "encoding": "utf8"
            }
        }
    });

    let response = process.send_request(&request).await.unwrap();
    assert!(response["error"].is_object());
    assert!(response["error"]["code"].is_string());
}

#[tokio::test]
async fn test_concurrent_requests() {
    let temp_dir = TempDir::new().unwrap();

    let mut process = ChildProcess::new().await;

    let mut handles = vec![];

    for i in 0..100 {
        let mut process = process.clone();
        let temp_dir = temp_dir.path().to_path_buf();
        let handle = tokio::spawn(async move {
            let test_file = temp_dir.join(format!("concurrent_{}.txt", i));
            let content = format!("Content {}", i);

            // Write
            let write_request = serde_json::json!({
                "jsonrpc": "2.0",
                "id": i * 2,
                "method": "onFileIORequest",
                "params": {
                    "method": "WriteFile",
                    "params": {
                        "path": test_file.to_string_lossy(),
                        "content": content,
                        "encoding": "utf8"
                    }
                }
            });

            process.send_request(&write_request).await.unwrap();

            // Read
            let read_request = serde_json::json!({
                "jsonrpc": "2.0",
                "id": i * 2 + 1,
                "method": "onFileIORequest",
                "params": {
                    "method": "ReadFile",
                    "params": {
                        "path": test_file.to_string_lossy(),
                        "encoding": "utf8"
                    }
                }
            });

            let read_response = process.send_request(&read_request).await.unwrap();
            assert_eq!(read_response["result"]["content"], content);
        });

        handles.push(handle);
    }

    for handle in handles {
        handle.await.unwrap();
    }
}

#[tokio::test]
async fn test_streaming_read() {
    let temp_dir = TempDir::new().unwrap();
    let test_file = temp_dir.path().join("large_file.txt");

    // Create a file > 1MB
    let large_content = "x".repeat(1024 * 1024 + 100);
    std::fs::write(&test_file, &large_content).unwrap();

    let mut process = ChildProcess::new().await;

    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "onFileIORequest",
        "params": {
            "method": "ReadFileStream",
            "params": {
                "path": test_file.to_string_lossy()
            }
        }
    });

    let mut chunks = vec![];

    loop {
        let response = process.send_request(&request).await.unwrap();
        if let Some(result) = response["result"].as_object() {
            if let Some(chunk) = result["chunk"].as_array() {
                chunks.extend(chunk.iter().map(|b| b.as_u64().unwrap() as u8));
            }
            if result["done"].as_bool().unwrap_or(false) {
                break;
            }
        } else {
            break;
        }
    }

    let received_content = String::from_utf8(chunks).unwrap();
    assert_eq!(received_content, large_content);
}

#[tokio::test]
async fn test_handle_lifecycle() {
    let temp_dir = TempDir::new().unwrap();
    let test_file = temp_dir.path().join("handle_test.txt");
    let content = "Handle lifecycle test content";

    let mut process = ChildProcess::new().await;

    // Open file
    let open_request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "onFileIORequest",
        "params": {
            "method": "OpenFile",
            "params": {
                "path": test_file.to_string_lossy(),
                "create": true
            }
        }
    });

    let open_response = process.send_request(&open_request).await.unwrap();
    let handle = open_response["result"]["handle"].as_u64().unwrap() as u32;

    // Write to handle
    let write_request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 2,
        "method": "onFileIORequest",
        "params": {
            "method": "WriteFileHandle",
            "params": {
                "handle": handle,
                "data": content.as_bytes().to_vec(),
                "offset": 0,
                "length": content.len() as u32
            }
        }
    });

    process.send_request(&write_request).await.unwrap();

    // Read from handle
    let read_request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 3,
        "method": "onFileIORequest",
        "params": {
            "method": "ReadFileHandle",
            "params": {
                "handle": handle,
                "length": content.len() as u32
            }
        }
    });

    let read_response = process.send_request(&read_request).await.unwrap();
    let data = read_response["result"]["data"].as_array().unwrap();
    let received_content = String::from_utf8(data.iter().map(|b| b.as_u64().unwrap() as u8).collect()).unwrap();
    assert_eq!(received_content, content);

    // Close handle
    let close_request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 4,
        "method": "onFileIORequest",
        "params": {
            "method": "CloseFile",
            "params": {
                "handle": handle
            }
        }
    });

    process.send_request(&close_request).await.unwrap();
}