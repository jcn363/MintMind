use base64::{Engine as _, engine::general_purpose};
use serde::{Deserialize, Serialize};
use std::io::{self, BufRead, Write};

#[derive(Deserialize)]
struct IRgMessage {
    #[serde(rename = "type")]
    message_type: String,
    data: IRgMatch,
}

#[derive(Deserialize)]
struct IRgMatch {
    path: IRgBytesOrText,
    lines: IRgBytesOrText,
    line_number: u32,
    absolute_offset: u64,
    submatches: Vec<IRgSubmatch>,
}

#[derive(Deserialize)]
struct IRgSubmatch {
    #[serde(rename = "match")]
    match_content: IRgBytesOrText,
    start: usize,
    end: usize,
}

#[derive(Deserialize)]
#[serde(untagged)]
enum IRgBytesOrText {
    Bytes { bytes: String },
    Text { text: String },
}

#[derive(Serialize)]
struct OutputMatch {
    uri: String,
    ranges: Vec<RangeLocation>,
    preview_text: String,
}

#[derive(Serialize)]
struct RangeLocation {
    source_range: Range,
    preview_range: Range,
}

#[derive(Serialize)]
struct Range {
    start_line: u32,
    start_col: u32,
    end_line: u32,
    end_col: u32,
}

fn bytes_or_text_to_string(obj: &IRgBytesOrText) -> String {
    match obj {
        IRgBytesOrText::Bytes { bytes } => {
            general_purpose::STANDARD.decode(bytes)
                .map(|b| String::from_utf8_lossy(&b).to_string())
                .unwrap_or_else(|_| String::new())
        }
        IRgBytesOrText::Text { text } => text.clone(),
    }
}

fn get_num_lines_and_last_newline_length(text: &str) -> (u32, u32) {
    let mut num_lines = 0;
    let mut last_newline_idx = None;

    for (i, ch) in text.char_indices() {
        if ch == '\n' {
            num_lines += 1;
            last_newline_idx = Some(i);
        }
    }

    let last_line_length = if let Some(idx) = last_newline_idx {
        text.len() - idx - 1
    } else {
        text.len()
    };

    (num_lines, last_line_length as u32)
}

fn process_match(data: &IRgMatch, root_uri: &str) -> OutputMatch {
    let line_number = data.line_number - 1; // 0-based
    let full_text = bytes_or_text_to_string(&data.lines);
    let full_text_bytes = full_text.as_bytes();

    let mut prev_match_end = 0;
    let mut prev_match_end_col = 0;
    let mut prev_match_end_line = line_number;

    let mut submatches = data.submatches.clone();
    if submatches.is_empty() {
        submatches.push(IRgSubmatch {
            match_content: if full_text.is_empty() {
                IRgBytesOrText::Text { text: String::new() }
            } else {
                IRgBytesOrText::Bytes {
                    bytes: general_purpose::STANDARD.encode(&full_text.as_bytes()[0..1]),
                }
            },
            start: 0,
            end: full_text.len().min(1),
        });
    }

    let ranges: Vec<RangeLocation> = submatches
        .iter()
        .map(|submatch| {
            let match_text = bytes_or_text_to_string(&submatch.match_content);
            let in_between_text = std::str::from_utf8(&full_text_bytes[prev_match_end..submatch.start])
                .unwrap_or("");
            let (in_between_num_lines, in_between_last_line_len) = get_num_lines_and_last_newline_length(in_between_text);

            let start_col = if in_between_num_lines > 0 {
                in_between_last_line_len
            } else {
                in_between_last_line_len + prev_match_end_col
            };

            let (match_num_lines, match_last_line_len) = get_num_lines_and_last_newline_length(&match_text);
            let start_line_number = in_between_num_lines + prev_match_end_line;
            let end_line_number = match_num_lines + start_line_number;
            let end_col = if match_num_lines > 0 {
                match_last_line_len
            } else {
                match_last_line_len + start_col
            };

            let range = Range {
                start_line: start_line_number,
                start_col,
                end_line: end_line_number,
                end_col,
            };

            prev_match_end = submatch.end;
            prev_match_end_col = end_col;
            prev_match_end_line = end_line_number;

            RangeLocation {
                source_range: range.clone(),
                preview_range: range,
            }
        })
        .collect();

    let uri = format!("{}/{}", root_uri, bytes_or_text_to_string(&data.path));

    OutputMatch {
        uri,
        ranges,
        preview_text: full_text,
    }
}

pub fn parse_ripgrep_output(root_uri: &str) -> Result<(), Box<dyn std::error::Error>> {
    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut stdout = stdout.lock();

    for line in stdin.lines() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }

        let message: IRgMessage = serde_json::from_str(&line)?;
        if message.message_type == "match" {
            let output = process_match(&message.data, root_uri);
            writeln!(stdout, "{}", serde_json::to_string(&output)?)?;
        }
        // Note: Context messages are not processed in this core implementation
        // as the user specified only match processing
    }

    Ok(())
}