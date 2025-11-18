/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use chrono::Local;
use opentelemetry_sdk::trace as sdktrace;
use opentelemetry::trace::TracerProvider as _;
use serde::{Deserialize, Serialize};
use tokio::io::AsyncWriteExt;

use crate::log::{Level, LogSink, Logger};

/// Console message structure for `__$console` type messages.
#[derive(Serialize, Deserialize, Debug)]
pub struct ConsoleMessage {
    #[serde(rename = "type")]
    pub r#type: String,
    pub severity: String,
    pub arguments: String, // JSON-serialized array
}

/// TypeScript LogLevel enum values.
#[derive(Debug, Clone, Copy)]
pub enum LogLevel {
    Off = 0,
    Trace = 1,
    Debug = 2,
    Info = 3,
    Warning = 4,
    Error = 5,
}

/// Utility to convert between TypeScript LogLevel and Rust Level enums.
pub struct LogLevelMapper;

impl LogLevelMapper {
    pub fn rust_to_typescript(rust_level: Level) -> LogLevel {
        match rust_level {
            Level::Off => LogLevel::Off,
            Level::Trace => LogLevel::Trace,
            Level::Debug => LogLevel::Debug,
            Level::Info => LogLevel::Info,
            Level::Warn => LogLevel::Warning,
            Level::Error => LogLevel::Error,
            Level::Critical => LogLevel::Error,
        }
    }

    pub fn typescript_to_rust(ts_level: LogLevel) -> Level {
        match ts_level {
            LogLevel::Off => Level::Off,
            LogLevel::Trace => Level::Trace,
            LogLevel::Debug => Level::Debug,
            LogLevel::Info => Level::Info,
            LogLevel::Warning => Level::Warn,
            LogLevel::Error => Level::Error,
        }
    }
}

/// IPC log sink that forwards log messages to TypeScript via IPC.
#[derive(Clone)]
pub struct IpcLogSink {
    sender: tokio::sync::mpsc::UnboundedSender<String>,
    level: Level,
}

impl IpcLogSink {
    pub fn new(sender: tokio::sync::mpsc::UnboundedSender<String>, level: Level) -> Self {
        Self { sender, level }
    }
}

impl LogSink for IpcLogSink {
    fn write_log(&self, level: Level, prefix: &str, message: &str) {
        if level < self.level {
            return;
        }

        let severity = match level {
            Level::Trace | Level::Debug => "log",
            Level::Warn => "warn",
            Level::Error | Level::Critical => "error",
            _ => "log",
        };

        let current = Local::now();
        let timestamp = current.format("%Y-%m-%d %H:%M:%S").to_string();
        let level_name = level.name().unwrap_or("unknown");
        let formatted_message = format!("[{}] {} {}{}", timestamp, level_name, prefix, message);

        let args = vec![formatted_message];
        let arguments = serde_json::to_string(&args).unwrap_or_else(|_| "[]".to_string());

        let msg = ConsoleMessage {
            r#type: "__$console".to_string(),
            severity: severity.to_string(),
            arguments,
        };

        if let Ok(json) = serde_json::to_string(&msg) {
            let _ = self.sender.send(json);
        }
    }

    fn write_result(&self, _message: &str) {}
}

/// Creates a logger with both StdioLogSink and IpcLogSink.
/// Spawns a background task to read from the receiver and write JSON lines to stdout.
pub fn create_ipc_logger(sender: tokio::sync::mpsc::UnboundedSender<String>, level: Level) -> Logger {
    // Create a channel for the background task
    let (bg_tx, mut bg_rx) = tokio::sync::mpsc::unbounded_channel::<String>();

    // Clone sender for the IPC sink
    let _ipc_sender = sender.clone();

    // IpcLogSink now uses the background task sender
    let ipc_sink = IpcLogSink::new(bg_tx, level);

    // Spawn background task to handle the logging
    tokio::spawn(async move {
        let mut stdout = tokio::io::stdout();
        while let Some(json_line) = bg_rx.recv().await {
            if let Err(e) = stdout.write_all(json_line.as_bytes()).await {
                eprintln!("Failed to write to stdout: {}", e);
                break;
            }
            if let Err(e) = stdout.write_all(b"\n").await {
                eprintln!("Failed to write newline to stdout: {}", e);
                break;
            }
            if let Err(e) = stdout.flush().await {
                eprintln!("Failed to flush stdout: {}", e);
                break;
            }
        }
    });

    let tracer = sdktrace::SdkTracerProvider::builder().build().tracer("ipc");
    Logger::new(tracer, level).tee(ipc_sink)
}