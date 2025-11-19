/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use crate::services::rgparser::parser::RipgrepParser;
use crate::services::rgparser::types::{ParsedResult, ParserStats, PreviewOptions};
use base64::{engine::general_purpose, Engine as _};
use serde_json;
use std::sync::Arc;
use tokio::sync::{Mutex, mpsc::UnboundedSender};
use serde::{Deserialize, Serialize};

/// RPC service exposing ripgrep parsing via IPC.
pub struct RgParserService {
    parser: Arc<Mutex<RipgrepParser>>,
    notification_tx: UnboundedSender<String>,
}

impl RgParserService {
    /// Creates a new RgParserService.
    pub fn new(notification_tx: UnboundedSender<String>) -> Self {
        let preview_options = PreviewOptions {
            match_lines: 1,
            chars_per_line: 1000,
        };
        let parser = RipgrepParser::new(10000, "file://".to_string(), preview_options);

        Self {
            parser: Arc::new(Mutex::new(parser)),
            notification_tx,
        }
    }

    /// Parses a line of ripgrep output and sends notifications via IPC.
    /// Expects the line parameter to be base64-encoded.
    pub async fn parse_line(&self, line: String) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let decoded_line = general_purpose::STANDARD.decode(&line)?;
        let line_str = String::from_utf8(decoded_line)?;

        let mut parser = self.parser.lock().await;
        if let Some(result) = parser.parse_line(&line_str)? {
            let json = serde_json::to_string(&result)?;
            let encoded = general_purpose::STANDARD.encode(json);
            let notification = format!("{{\"method\":\"onResult\",\"params\":{{\"result\":\"{}\"}}}}", encoded);

            if let Err(e) = self.notification_tx.send(notification) {
                eprintln!("Failed to send notification: {}", e);
            }
        }

        Ok(())
    }

    /// Sets the maximum number of results to parse.
    pub async fn set_max_results(&self, max_results: usize) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut parser = self.parser.lock().await;
        parser.max_results = max_results;
        Ok(())
    }

    /// Resets the parser state.
    pub async fn reset(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut parser = self.parser.lock().await;
        parser.reset();
        Ok(())
    }

    /// Returns current parser statistics.
    pub async fn get_stats(&self) -> Result<ParserStats, Box<dyn std::error::Error + Send + Sync>> {
        let parser = self.parser.lock().await;
        let (num_results, hit_limit) = parser.get_stats();
        Ok(ParserStats { num_results, hit_limit })
    }
}

/// RPC methods for the RgParserService.
#[derive(Deserialize, Debug)]
#[serde(tag = "method", content = "params")]
pub enum RgParserRequest {
    #[serde(rename = "parse_line")]
    ParseLine { line: String },
    #[serde(rename = "set_max_results")]
    SetMaxResults { max_results: usize },
    #[serde(rename = "reset")]
    Reset,
    #[serde(rename = "get_stats")]
    GetStats,
}

/// Handles an RPC request for the RgParserService.
pub async fn handle_rgparser_request(
    service: &Arc<RgParserService>,
    request: RgParserRequest,
) -> Result<serde_json::Value, Box<dyn std::error::Error + Send + Sync>> {
    match request {
        RgParserRequest::ParseLine { line } => {
            service.parse_line(line).await?;
            Ok(serde_json::json!(null))
        }
        RgParserRequest::SetMaxResults { max_results } => {
            service.set_max_results(max_results).await?;
            Ok(serde_json::json!(null))
        }
        RgParserRequest::Reset => {
            service.reset().await?;
            Ok(serde_json::json!(null))
        }
        RgParserRequest::GetStats => {
            let stats = service.get_stats().await?;
            Ok(serde_json::to_value(stats)?)
        }
    }
}