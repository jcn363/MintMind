/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use serde::{Deserialize, Serialize, Deserializer};
use std::collections::HashMap;

/// Represents a position in a text document (line and character offset).
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Position {
    pub line: usize,
    pub character: usize,
}

/// Represents a range in a text document with start and end positions.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Range {
    pub start: Position,
    pub end: Position,
}

/// Represents a text search match result.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TextSearchMatch {
    pub uri: String,
    pub ranges: TextSearchMatchRanges,
    pub preview_text: String,
}

/// Represents ranges for a text search match (source range and preview range).
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TextSearchMatchRanges {
    #[serde(rename = "source_range")]
    pub source_range: Range,
    #[serde(rename = "preview_range")]
    pub preview_range: Range,
}

/// Represents a text search context result.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TextSearchContext {
    pub uri: String,
    pub text: String,
    #[serde(rename = "line_number")]
    pub line_number: usize,
}

/// Enum representing either a match or context result from parsing.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(untagged)]
pub enum ParsedResult {
    Match(TextSearchMatch),
    Context(TextSearchContext),
}

/// Represents a message from ripgrep JSON output.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RgMessage {
    #[serde(rename = "type")]
    pub message_type: String,
    pub data: RgMessageData,
}

/// Enum for ripgrep message data (match or context).
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(untagged)]
pub enum RgMessageData {
    Match(RgMatch),
    Context(RgContext),
}

/// Represents a match message from ripgrep.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RgMatch {
    pub path: RgBytesOrText,
    pub lines: RgBytesOrText,
    #[serde(rename = "line_number")]
    pub line_number: usize,
    pub absolute_offset: usize,
    pub submatches: Vec<RgSubmatch>,
}

/// Represents a context message from ripgrep.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RgContext {
    pub path: RgBytesOrText,
    pub lines: RgBytesOrText,
    #[serde(rename = "line_number")]
    pub line_number: usize,
    pub absolute_offset: usize,
}

/// Represents a submatch within a ripgrep match.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RgSubmatch {
    #[serde(rename = "match")]
    pub match_text: RgBytesOrText,
    pub start: usize,
    pub end: usize,
}

/// Enum representing either bytes or text in ripgrep output.
/// Can be either a base64-encoded byte array or a UTF-8 string.
#[derive(Debug, Clone)]
pub enum RgBytesOrText {
    Text(String),
    Bytes(Vec<u8>),
}

impl<'de> Deserialize<'de> for RgBytesOrText {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        // Try to deserialize as a string first
        if let Ok(text) = String::deserialize(deserializer) {
            return Ok(RgBytesOrText::Text(text));
        }

        // If that fails, try to deserialize as a HashMap with "bytes" field
        let value: serde_json::Value = Deserialize::deserialize(deserializer)?;
        if let Some(bytes_str) = value.get("bytes").and_then(|v| v.as_str()) {
            match base64::engine::general_purpose::STANDARD.decode(bytes_str) {
                Ok(bytes) => Ok(RgBytesOrText::Bytes(bytes)),
                Err(_) => Err(serde::de::Error::custom("Invalid base64 in bytes field")),
            }
        } else {
            Err(serde::de::Error::custom("Expected string or {bytes: base64string}"))
        }
    }
}

impl Serialize for RgBytesOrText {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        match self {
            RgBytesOrText::Text(text) => serializer.serialize_str(text),
            RgBytesOrText::Bytes(bytes) => {
                let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
                let mut map = HashMap::new();
                map.insert("bytes", encoded);
                serializer.serialize_some(&map)
            }
        }
    }
}

/// Preview options for text search results.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PreviewOptions {
    pub match_lines: usize,
    pub chars_per_line: usize,
}

/// Statistics for the parser service.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ParserStats {
    pub num_results: usize,
    pub hit_limit: bool,
}