/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, BufReader, AsyncWriteExt, duplex};
use tokio::sync::mpsc;
use tokio::task;

use crate::rpc::{RpcBuilder, RpcDispatcher};
use crate::services::ipc::{Base64Serialization, NodeIpcTransport};
use crate::json_rpc::JsonRpcSerializer;
use crate::log;

#[tokio::test]
async fn test_base64_serialization() {
    let serializer = Base64Serialization::new(JsonRpcSerializer {});
    let test_data = serde_json::json!({"test": "value", "number": 42});

    let serialized = serializer.serialize(&test_data);
    let deserialized: serde_json::Value = serializer.deserialize(&serialized).unwrap();

    assert_eq!(test_data, deserialized);
    assert!(String::from_utf8(serialized).unwrap().ends_with("=\n") || !serialized.contains(&b'='[0]));
}

#[tokio::test]
async fn test_console_log_detection() {
    let (client, server) = duplex(1024);
    let mut client_reader = BufReader::new(client);
    let mut server_writer = server;

    let logger = log::Logger::new("test");
    let base64_serializer = Base64Serialization::new(JsonRpcSerializer {});
    let rpc_builder = RpcBuilder::new(base64_serializer);
    let dispatcher = rpc_builder.methods(()).build(logger);

    let transport = NodeIpcTransport::new(dispatcher);

    let server_handle = task::spawn(async move {
        let mut transport = transport;
        let (write_tx, _) = mpsc::unbounded_channel();
        transport.write_tx = Some(write_tx);

        let mut line = String::new();
        loop {
            if client_reader.read_line(&mut line).await.unwrap() == 0 {
                break;
            }
            let message = line.trim();
            if !message.is_empty() {
                let _ = transport.handle_message(message).await;
            }
            line.clear();
        }
    });

    // Send console log message
    let console_msg = r#"{"type":"__$console","severity":"info","arguments":["test log"]}"#;
    server_writer.write_all(console_msg.as_bytes()).await.unwrap();
    server_writer.write_all(b"\n").await.unwrap();
    server_writer.flush().await.unwrap();

    server_handle.abort();
}

#[tokio::test]
async fn test_rpc_call_response() {
    let (client_writer, server_reader) = duplex(1024);
    let (server_writer, client_reader) = duplex(1024);

    let logger = log::Logger::new("test");
    let base64_serializer = Base64Serialization::new(JsonRpcSerializer {});
    let rpc_builder = RpcBuilder::new(base64_serializer);
    let mut methods = std::collections::HashMap::new();
    methods.insert("echo".to_string(), Box::new(|params: serde_json::Value| {
        async move { Some(serde_json::json!({"result": params})) }
    }) as Box<dyn Fn(serde_json::Value) -> std::pin::Pin<Box<dyn std::future::Future<Output = Option<serde_json::Value>> + Send>> + Send + Sync>);
    let dispatcher = rpc_builder.methods(methods).build(logger);

    let mut transport = NodeIpcTransport::new(dispatcher);
    let (write_tx, mut write_rx) = mpsc::unbounded_channel();
    transport.write_tx = Some(write_tx);

    let transport_handle = task::spawn(async move {
        let mut stdin = BufReader::new(server_reader);
        let mut stdout = server_writer;
        let mut line = String::new();

        loop {
            tokio::select! {
                read_result = stdin.read_line(&mut line) => {
                    match read_result {
                        Ok(0) => break,
                        Ok(_) => {
                            let message = line.trim();
                            if !message.is_empty() {
                                let _ = transport.handle_message(message).await;
                            }
                            line.clear();
                        }
                        Err(_) => break,
                    }
                }
                Some(data) = write_rx.recv() => {
                    let _ = stdout.write_all(&data).await;
                    let _ = stdout.write_all(b"\n").await;
                    let _ = stdout.flush().await;
                }
            }
        }
    });

    // Send RPC request
    let request = r#"{"id":1,"method":"echo","params":"hello"}"#;
    let encoded_request = base64::engine::general_purpose::STANDARD.encode(request);
    client_writer.write_all(encoded_request.as_bytes()).await.unwrap();
    client_writer.write_all(b"\n").await.unwrap();
    client_writer.flush().await.unwrap();

    // Read response
    let mut response_line = String::new();
    let mut response_reader = BufReader::new(client_reader);
    response_reader.read_line(&mut response_line).await.unwrap();
    let response_str = response_line.trim();
    let decoded_response = base64::engine::general_purpose::STANDARD.decode(response_str).unwrap();
    let response_json: serde_json::Value = serde_json::from_slice(&decoded_response).unwrap();

    assert_eq!(response_json["id"], 1);
    assert_eq!(response_json["result"]["params"], "hello");

    transport_handle.abort();
}

#[tokio::test]
async fn test_malformed_message_handling() {
    let (client, server) = duplex(1024);
    let mut client_reader = BufReader::new(client);
    let mut server_writer = server;

    let logger = log::Logger::new("test");
    let base64_serializer = Base64Serialization::new(JsonRpcSerializer {});
    let rpc_builder = RpcBuilder::new(base64_serializer);
    let dispatcher = rpc_builder.methods(()).build(logger);

    let transport = NodeIpcTransport::new(dispatcher);

    let server_handle = task::spawn(async move {
        let mut transport = transport;
        let (write_tx, _) = mpsc::unbounded_channel();
        transport.write_tx = Some(write_tx);

        let mut line = String::new();
        loop {
            if client_reader.read_line(&mut line).await.unwrap() == 0 {
                break;
            }
            let message = line.trim();
            if !message.is_empty() {
                let result = transport.handle_message(message).await;
                assert!(result.is_err()); // Should handle error gracefully
            }
            line.clear();
        }
    });

    // Send invalid base64
    let invalid_msg = "invalid base64!";
    server_writer.write_all(invalid_msg.as_bytes()).await.unwrap();
    server_writer.write_all(b"\n").await.unwrap();
    server_writer.flush().await.unwrap();

    // Send invalid JSON after base64 decode
    let invalid_json = base64::engine::general_purpose::STANDARD.encode("{invalid json");
    server_writer.write_all(invalid_json.as_bytes()).await.unwrap();
    server_writer.write_all(b"\n").await.unwrap();
    server_writer.flush().await.unwrap();

    server_handle.abort();
}

#[tokio::test]
async fn test_concurrent_messages() {
    let (client_writer, server_reader) = duplex(1024);
    let (server_writer, client_reader) = duplex(1024);

    let logger = log::Logger::new("test");
    let base64_serializer = Base64Serialization::new(JsonRpcSerializer {});
    let rpc_builder = RpcBuilder::new(base64_serializer);
    let mut methods = std::collections::HashMap::new();
    methods.insert("delay".to_string(), Box::new(|params: serde_json::Value| {
        async move {
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
            Some(serde_json::json!({"result": params}))
        }
    }) as Box<dyn Fn(serde_json::Value) -> std::pin::Pin<Box<dyn std::future::Future<Output = Option<serde_json::Value>> + Send>> + Send + Sync>);
    let dispatcher = rpc_builder.methods(methods).build(logger);

    let mut transport = NodeIpcTransport::new(dispatcher);
    let (write_tx, mut write_rx) = mpsc::unbounded_channel();
    transport.write_tx = Some(write_tx);

    let transport_handle = task::spawn(async move {
        let mut stdin = BufReader::new(server_reader);
        let mut stdout = server_writer;
        let mut line = String::new();

        loop {
            tokio::select! {
                read_result = stdin.read_line(&mut line) => {
                    match read_result {
                        Ok(0) => break,
                        Ok(_) => {
                            let message = line.trim();
                            if !message.is_empty() {
                                let _ = transport.handle_message(message).await;
                            }
                            line.clear();
                        }
                        Err(_) => break,
                    }
                }
                Some(data) = write_rx.recv() => {
                    let _ = stdout.write_all(&data).await;
                    let _ = stdout.write_all(b"\n").await;
                    let _ = stdout.flush().await;
                }
            }
        }
    });

    // Send multiple concurrent requests
    let mut handles = vec![];
    for i in 1..=5 {
        let client_writer = &client_writer;
        let request = format!(r#"{{"id":{},"method":"delay","params":"request{}"}}"#, i, i);
        let encoded_request = base64::engine::general_purpose::STANDARD.encode(&request);
        let handle = task::spawn(async move {
            let mut writer = client_writer.clone();
            writer.write_all(encoded_request.as_bytes()).await.unwrap();
            writer.write_all(b"\n").await.unwrap();
            writer.flush().await.unwrap();
        });
        handles.push(handle);
    }

    for handle in handles {
        handle.await.unwrap();
    }

    // Read responses (order may vary)
    let mut response_reader = BufReader::new(client_reader);
    let mut received_ids = std::collections::HashSet::new();
    for _ in 0..5 {
        let mut response_line = String::new();
        response_reader.read_line(&mut response_line).await.unwrap();
        let response_str = response_line.trim();
        let decoded_response = base64::engine::general_purpose::STANDARD.decode(response_str).unwrap();
        let response_json: serde_json::Value = serde_json::from_slice(&decoded_response).unwrap();
        let id = response_json["id"].as_u64().unwrap();
        received_ids.insert(id);
    }

    assert_eq!(received_ids.len(), 5);
    for i in 1..=5 {
        assert!(received_ids.contains(&i));
    }

    transport_handle.abort();
}