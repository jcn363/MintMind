/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use crate::services::rgparser::converter::{ByteOffsetConverter, bytes_or_text_to_string, convert_byte_offset_to_position};
use crate::services::rgparser::types::{ParsedResult, PreviewOptions, Position, Range, RgBytesOrText, RgMessage, RgMessageData, TextSearchContext, TextSearchMatch, TextSearchMatchRanges};
use serde_json;

/// Core parser for processing ripgrep JSON output line-by-line.
pub struct RipgrepParser {
    pub max_results: usize,
    pub num_results: usize,
    pub hit_limit: bool,
    pub root_uri: String,
    pub preview_options: PreviewOptions,
    converter: ByteOffsetConverter,
    current_file_content: Option<String>,
}

impl RipgrepParser {
    /// Creates a new RipgrepParser.
    pub fn new(max_results: usize, root_uri: String, preview_options: PreviewOptions) -> Self {
        Self {
            max_results,
            num_results: 0,
            hit_limit: false,
            root_uri,
            preview_options,
            converter: ByteOffsetConverter::new(),
            current_file_content: None,
        }
    }

    /// Parses a single line of ripgrep JSON output.
    /// Returns Some(ParsedResult) if a result was parsed, None if the line was skipped.
    pub fn parse_line(&mut self, line: &str) -> Result<Option<ParsedResult>, Box<dyn std::error::Error + Send + Sync>> {
        if self.hit_limit {
            return Ok(None);
        }

        let trimmed = line.trim();
        if trimmed.is_empty() {
            return Ok(None);
        }

        let message: RgMessage = match serde_json::from_str(trimmed) {
            Ok(msg) => msg,
            Err(e) => {
                eprintln!("Failed to parse ripgrep JSON: {} (line: {})", e, line);
                return Ok(None);
            }
        };

        match message.data {
            RgMessageData::Match(rg_match) => self.handle_match_message(rg_match),
            RgMessageData::Context(rg_context) => self.handle_context_message(rg_context),
        }
    }

    /// Handles a match message from ripgrep.
    fn handle_match_message(&mut self, rg_match: crate::services::rgparser::types::RgMatch) -> Result<Option<ParsedResult>, Box<dyn std::error::Error + Send + Sync>> {
        if self.num_results >= self.max_results {
            self.hit_limit = true;
            return Ok(None);
        }

        let path_text = bytes_or_text_to_string(&rg_match.path)?;
        let uri = format!("{}{}", self.root_uri, path_text);

        // For multi-line matches, we need to handle each submatch
        if rg_match.submatches.is_empty() {
            return Ok(None);
        }

        // Use the first submatch for the main match
        let submatch = &rg_match.submatches[0];
        let lines_text = bytes_or_text_to_string(&rg_match.lines)?;

        // Update converter with current file content if different
        if self.current_file_content.as_ref().map_or(true, |content| content != &lines_text) {
            self.converter.update_content(&lines_text);
            self.current_file_content = Some(lines_text.clone());
        }

        let (start_line, start_col) = convert_byte_offset_to_position(&lines_text, submatch.start);
        let (end_line, end_col) = convert_byte_offset_to_position(&lines_text, submatch.end);

        // Adjust line numbers relative to the actual file
        let absolute_start_line = rg_match.line_number - 1 + start_line;
        let absolute_end_line = rg_match.line_number - 1 + end_line;

        let source_range = Range {
            start: Position {
                line: absolute_start_line,
                character: start_col,
            },
            end: Position {
                line: absolute_end_line,
                character: end_col,
            },
        };

        // For preview, we'll use the same range for now (can be extended later)
        let preview_range = source_range.clone();

        // Generate preview text
        let preview_text = self.generate_preview_text(&lines_text, &source_range);

        self.num_results += 1;

        Ok(Some(ParsedResult::Match(TextSearchMatch {
            uri,
            ranges: TextSearchMatchRanges {
                source_range,
                preview_range,
            },
            preview_text,
        })))
    }

    /// Handles a context message from ripgrep.
    fn handle_context_message(&mut self, rg_context: crate::services::rgparser::types::RgContext) -> Result<Option<ParsedResult>, Box<dyn std::error::Error + Send + Sync>> {
        if self.num_results >= self.max_results {
            self.hit_limit = true;
            return Ok(None);
        }

        let path_text = bytes_or_text_to_string(&rg_context.path)?;
        let uri = format!("{}{}", self.root_uri, path_text);
        let text = bytes_or_text_to_string(&rg_context.lines)?;
        let line_number = rg_context.line_number - 1; // Convert to 0-based

        self.num_results += 1;

        Ok(Some(ParsedResult::Context(TextSearchContext {
            uri,
            text,
            line_number,
        })))
    }

    /// Generates preview text for a match based on the source range and preview options.
    fn generate_preview_text(&self, full_text: &str, source_range: &Range) -> String {
        // For simplicity, return the text of the line containing the match
        let lines: Vec<&str> = full_text.lines().collect();
        if source_range.start.line < lines.len() {
            lines[source_range.start.line].to_string()
        } else {
            "".to_string()
        }
    }

    /// Resets the parser state.
    pub fn reset(&mut self) {
        self.num_results = 0;
        self.hit_limit = false;
        self.current_file_content = None;
        self.converter = ByteOffsetConverter::new();
    }

    /// Returns current statistics (num_results, hit_limit).
    pub fn get_stats(&self) -> (usize, bool) {
        (self.num_results, self.hit_limit)
    }
}