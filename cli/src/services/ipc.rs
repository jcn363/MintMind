/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use base64::{engine::general_purpose, Engine as _};
use opentelemetry_sdk::trace as sdktrace;
use opentelemetry::trace::TracerProvider as _;
use serde::{Deserialize, Serialize};
use tokio::{
	io::{AsyncBufReadExt, BufReader, AsyncWriteExt},
	sync::mpsc,
};

use crate::{
	log,
	rpc::{MaybeSync, RpcBuilder, RpcDispatcher, Serialization},
	util::errors::{AnyError, CodeError, InvalidRpcDataError},
};

/// Serialization wrapper that adds base64 encoding/decoding around an underlying serializer.
/// Compatible with TypeScript's ipc.cp.ts base64 encoding scheme.
#[derive(Clone)]
pub struct Base64Serialization<S: Clone> {
	inner: S,
}

impl<S: Clone> Base64Serialization<S> {
	pub fn new(serializer: S) -> Self {
		Self { inner: serializer }
	}
}

impl<S: Serialization + Clone> Serialization for Base64Serialization<S> {
	fn serialize(&self, value: impl Serialize) -> Vec<u8> {
		let inner_bytes = self.inner.serialize(value);
		let encoded = general_purpose::STANDARD.encode(&inner_bytes);
		encoded.into_bytes()
	}

	fn deserialize<P: serde::de::DeserializeOwned>(&self, b: &[u8]) -> Result<P, AnyError> {
		let str_data = std::str::from_utf8(b).map_err(|e| InvalidRpcDataError(e.to_string()))?;
		let decoded = general_purpose::STANDARD
			.decode(str_data)
			.map_err(|e| InvalidRpcDataError(format!("base64 decode failed: {}", e)))?;
		self.inner.deserialize(&decoded)
	}
}

/// Console log message structure for `__$console` type messages.
#[derive(Serialize, Deserialize, Debug)]
pub struct ConsoleLogMessage {
	pub r#type: String,
	pub severity: String,
	pub arguments: Vec<serde_json::Value>,
}

/// Transport for Node.js IPC-style communication (process.send/process.on('message')).
/// Handles stdin/stdout with line-based message exchange.
pub struct NodeIpcTransport<S: Clone, C> {
	dispatcher: RpcDispatcher<Base64Serialization<S>, C>,
	write_tx: Option<mpsc::UnboundedSender<Vec<u8>>>,
	notification_rx: mpsc::UnboundedReceiver<String>,
}

impl<S: Serialization + Send + Sync + Clone + 'static, C: Send + Sync + Clone + 'static> NodeIpcTransport<S, C> {
	pub fn new(dispatcher: RpcDispatcher<Base64Serialization<S>, C>, notification_rx: mpsc::UnboundedReceiver<String>) -> Self {
		Self {
			dispatcher,
			write_tx: None,
			notification_rx,
		}
	}

	/// Starts the IPC server loop, reading from stdin and writing to stdout.
	pub async fn run(mut self) -> Result<(), CodeError> {
		let mut stdin = BufReader::new(tokio::io::stdin());
		let mut stdout = tokio::io::stdout();
		let mut line = String::new();
		let (write_tx, mut write_rx) = mpsc::unbounded_channel::<Vec<u8>>();
		self.write_tx = Some(write_tx);

		loop {
			tokio::select! {
				// Read from stdin
				read_result = stdin.read_line(&mut line) => {
					match read_result {
						Ok(0) => return Ok(()), // EOF
						Ok(_) => {
							let message = line.trim();
							if !message.is_empty() {
								if let Err(e) = self.handle_message(message).await {
									warning!(log::Logger::test(), "Failed to handle IPC message: {:?}", e);
								}
							}
							line.clear();
						}
						Err(e) => return Err(CodeError::AsyncPipeFailed(e)),
					}
				}
				// Write to stdout
				Some(data) = write_rx.recv() => {
					if let Err(e) = stdout.write_all(&data).await {
						return Err(CodeError::AsyncPipeFailed(e));
					}
					if let Err(e) = stdout.write_all(b"\n").await {
						return Err(CodeError::AsyncPipeFailed(e));
					}
					if let Err(e) = stdout.flush().await {
						return Err(CodeError::AsyncPipeFailed(e));
					}
				}
				// Handle notifications from service
				Some(notification) = self.notification_rx.recv() => {
					if let Err(e) = stdout.write_all(notification.as_bytes()).await {
						return Err(CodeError::AsyncPipeFailed(e));
					}
					if let Err(e) = stdout.write_all(b"\n").await {
						return Err(CodeError::AsyncPipeFailed(e));
					}
					if let Err(e) = stdout.flush().await {
						return Err(CodeError::AsyncPipeFailed(e));
					}
				}
			}
		}
	}

	async fn handle_message(&mut self, message: &str) -> Result<(), AnyError> {
		if is_console_log_message(message) {
			let console_msg: ConsoleLogMessage = serde_json::from_str(message).map_err(|e| InvalidRpcDataError(e.to_string()))?;
			handle_console_log(&log::Logger::test(), console_msg);
			Ok(())
		} else {
			let data = message.as_bytes();
			match self.dispatcher.dispatch(data) {
				MaybeSync::Sync(Some(response)) => {
					let _ = self.write_tx.as_ref().unwrap().send(response);
					Ok(())
				}
				MaybeSync::Sync(None) => Ok(()),
				MaybeSync::Future(fut) => {
					let write_tx = self.write_tx.as_ref().unwrap().clone();
					tokio::spawn(async move {
						if let Some(response) = fut.await {
							let _ = write_tx.send(response);
						}
					});
					Ok(())
				}
				MaybeSync::Stream((stream, fut)) => {
					if let Some(stream) = stream {
						let write_tx_bounded = mpsc::channel::<Vec<u8>>(8).0;
						let _write_tx = self.write_tx.as_ref().unwrap().clone();
						let dispatcher = self.dispatcher.clone();
						tokio::spawn(async move {
							let _ = dispatcher.register_stream(write_tx_bounded, stream).await;
						});
					}
					let _write_tx = self.write_tx.as_ref().unwrap().clone();
					tokio::spawn(async move {
						if let Some(response) = fut.await {
							let _ = _write_tx.send(response);
						}
					});
					Ok(())
				}
			}
		}
	}
}

/// Checks if a message is a console log message by parsing JSON and checking type.
fn is_console_log_message(message: &str) -> bool {
	if let Ok(value) = serde_json::from_str::<serde_json::Value>(message) {
		if let Some(type_val) = value.get("type") {
			if let Some(type_str) = type_val.as_str() {
				return type_str == "__$console";
			}
		}
	}
	false
}

/// Handles console log messages by forwarding them to the logger.
fn handle_console_log(logger: &log::Logger, msg: ConsoleLogMessage) {
	let level = match msg.severity.as_str() {
		"error" => log::Level::Error,
		"warn" => log::Level::Warn,
		"info" => log::Level::Info,
		"debug" => log::Level::Debug,
		_ => log::Level::Info,
	};

	let args_str = msg
		.arguments
		.iter()
		.map(|arg| arg.to_string())
		.collect::<Vec<_>>()
		.join(" ");

	match level {
	    log::Level::Error => error!(logger, "IPC: {}", args_str),
	    log::Level::Warn => warning!(logger, "IPC: {}", args_str),
	    log::Level::Info => info!(logger, "IPC: {}", args_str),
	    log::Level::Debug => debug!(logger, "IPC: {}", args_str),
	    log::Level::Trace => trace!(logger, "IPC: {}", args_str),
	    log::Level::Critical => error!(logger, "IPC: {}", args_str),
	    log::Level::Off => {},
	}
}

/// Starts a Node.js IPC server using base64-encoded JSON-RPC over stdin/stdout.
/// Sets up RPC dispatcher with base64 transport and handles both regular RPC messages
/// and console log forwarding.
pub async fn start_node_ipc_server_with<S: Serialization + Send + Sync + Clone + 'static, C: Send + Sync + Clone + 'static>(
	dispatcher: RpcDispatcher<Base64Serialization<S>, C>,
	notification_rx: mpsc::UnboundedReceiver<String>,
) -> Result<(), CodeError> {
	let transport = NodeIpcTransport::new(dispatcher, notification_rx);
	transport.run().await
}

/// Starts a Node.js IPC server using base64-encoded JSON-RPC over stdin/stdout.
/// Sets up RPC dispatcher with base64 transport and handles both regular RPC messages
/// and console log forwarding.
pub async fn start_node_ipc_server() -> Result<(), CodeError> {
	let base64_serializer = Base64Serialization::new(crate::json_rpc::JsonRpcSerializer {});
	let rpc_builder = RpcBuilder::new(base64_serializer);
    let provider = sdktrace::TracerProvider::builder().build();
    let tracer = provider.tracer("node_ipc");
	let dispatcher = rpc_builder.methods(()).build(crate::log::Logger::new(tracer, crate::log::Level::Info));

	// Create dummy notification channel for compatibility
	let (_tx, rx) = tokio::sync::mpsc::unbounded_channel::<String>();
	start_node_ipc_server_with(dispatcher, rx).await
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn test_base64_serialization() {
		let serializer = Base64Serialization::new(crate::json_rpc::JsonRpcSerializer {});
		let test_data = serde_json::json!({"test": "value"});

		let serialized = serializer.serialize(&test_data);
		let deserialized: serde_json::Value = serializer.deserialize(&serialized).unwrap();

		assert_eq!(test_data, deserialized);
	}

	#[test]
	fn test_console_log_detection() {
		let console_msg = r#"{"type":"__$console","severity":"info","arguments":["hello"]}"#;
		let rpc_msg = r#"{"id":1,"method":"test","params":{}}"#;

		assert!(is_console_log_message(console_msg));
		assert!(!is_console_log_message(rpc_msg));
	}

	#[test]
	fn test_console_log_detection_property_order() {
		// Test with different property orders
		let console_msg1 = r#"{"type":"__$console","severity":"info","arguments":["hello"]}"#;
		let console_msg2 = r#"{"severity":"info","type":"__$console","arguments":["hello"]}"#;
		let console_msg3 = r#"{"arguments":["hello"],"type":"__$console","severity":"info"}"#;
		let rpc_msg = r#"{"id":1,"method":"test","params":{}}"#;

		assert!(is_console_log_message(console_msg1));
		assert!(is_console_log_message(console_msg2));
		assert!(is_console_log_message(console_msg3));
		assert!(!is_console_log_message(rpc_msg));
	}

	#[test]
	fn test_console_log_detection_whitespace() {
		// Test with whitespace variations
		let console_msg1 = r#"{"type":"__$console","severity":"info","arguments":["hello"]}"#;
		let console_msg2 = r#" { "type" : "__$console" , "severity" : "info" , "arguments" : [ "hello" ] } "#;
		let console_msg3 = r#"
			{
				"type": "__$console",
				"severity": "info",
				"arguments": ["hello"]
			}
		"#;
		let invalid_json = r#"{"type":"__$console","severity":invalid}"#;

		assert!(is_console_log_message(console_msg1));
		assert!(is_console_log_message(console_msg2));
		assert!(is_console_log_message(console_msg3));
		assert!(!is_console_log_message(invalid_json)); // Invalid JSON should not be detected
	}

	#[test]
	fn test_malformed_base64() {
		let serializer = Base64Serialization::new(crate::json_rpc::JsonRpcSerializer {});
		let invalid_base64 = b"invalid base64!";

		let result: Result<serde_json::Value, _> = serializer.deserialize(invalid_base64);
		assert!(result.is_err());
	}
}