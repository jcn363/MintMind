/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use crate::services::rgparser::types::{RgBytesOrText, Position};
use base64::{engine::general_purpose, Engine as _};
use std::collections::HashMap;

/// ByteOffsetConverter caches newline positions for efficient byte-to-line conversion.
pub struct ByteOffsetConverter {
    /// Cached positions of newline characters (byte offsets where newlines occur).
    newline_positions: Vec<usize>,
}

impl ByteOffsetConverter {
    /// Creates a new ByteOffsetConverter with an empty cache.
    pub fn new() -> Self {
        Self {
            newline_positions: Vec::new(),
        }
    }

    /// Updates the converter with the content of a file to cache newline positions.
    /// This should be called before performing conversions for a specific file.
    pub fn update_content(&mut self, content: &str) {
        self.newline_positions.clear();
        self.newline_positions.push(0); // Line 0 starts at byte 0

        for (byte_offset, ch) in content.char_indices() {
            if ch == '\n' {
                self.newline_positions.push(byte_offset + 1); // Next line starts after newline
            }
        }
    }

    /// Converts a byte offset to line and column position.
    /// Returns (line_number, column) where line_number is 0-based and column is 0-based character offset.
    pub fn byte_offset_to_position(&self, byte_offset: usize) -> (usize, usize) {
        // Find the line where this byte offset belongs
        let line = match self.newline_positions.binary_search(&byte_offset) {
            Ok(idx) => idx, // Exact match means we're at the start of a line
            Err(idx) => idx.saturating_sub(1), // Insert position gives us the line
        };

        let line_start_offset = if line < self.newline_positions.len() {
            self.newline_positions[line]
        } else {
            // Beyond the last newline, but this shouldn't happen if content is updated properly
            0
        };

        let column = byte_offset - line_start_offset;
        (line, column)
    }
}

/// Converts a byte offset to line and column position using the TypeScript algorithm.
/// This replicates the `getNumLinesAndLastNewlineLength()` logic from TypeScript.
/// Returns (line_number, column) where line_number is 0-based and column is 0-based.
pub fn convert_byte_offset_to_position(text: &str, byte_offset: usize) -> (usize, usize) {
    let mut line = 0;
    let mut current_offset = 0;

    for (i, ch) in text.char_indices() {
        if i >= byte_offset {
            break;
        }
        if ch == '\n' {
            line += 1;
            current_offset = i + 1;
        }
    }

    let column = byte_offset - current_offset;
    (line, column)
}

/// Converts RgBytesOrText to a String, decoding base64 if necessary.
/// Uses the STANDARD base64 engine for decoding.
pub fn bytes_or_text_to_string(obj: &RgBytesOrText) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    match obj {
        RgBytesOrText::Text(text) => Ok(text.clone()),
        RgBytesOrText::Bytes(bytes) => {
            String::from_utf8(bytes.clone())
                .map_err(|e| format!("Invalid UTF-8 in bytes: {}", e).into())
        }
    }
}