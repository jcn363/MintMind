/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use url::Url;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FileChangeType {
    #[serde(rename = "0")]
    Updated,
    #[serde(rename = "1")]
    Added,
    #[serde(rename = "2")]
    Deleted,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FileChange {
    pub resource: String, // URI string
    pub change_type: FileChangeType,
    #[serde(rename = "cId")]
    pub correlation_id: Option<u32>,
    pub mtime: Option<i64>, // milliseconds since epoch
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FileChangeFilter {
    #[serde(rename = "1")]
    Updated = 1,
    #[serde(rename = "2")]
    Added = 2,
    #[serde(rename = "3")]
    Deleted = 4,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchRequest {
    pub path: String, // URI string
    pub recursive: bool,
    pub excludes: Vec<String>,
    pub includes: Option<Vec<String>>,
    pub correlation_id: Option<u32>,
    pub filter: Option<FileChangeFilter>,
    pub polling_interval: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchResponse {
    pub id: String,
    pub changes: Vec<FileChange>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnwatchRequest {
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatcherError {
    pub message: String,
    pub code: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WatcherMessage {
    Watch(WatchRequest),
    Unwatch(UnwatchRequest),
    Changes(WatchResponse),
    Error(WatcherError),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatcherConfig {
    pub recursive: bool,
    pub polling_interval: Option<u32>,
    pub excludes: Vec<String>,
    pub includes: Vec<String>,
}

pub fn normalize_path(path: PathBuf) -> PathBuf {
    #[cfg(target_os = "linux")]
    {
        path // No normalization needed on Linux (case-sensitive)
    }
    #[cfg(target_os = "macos")]
    {
        // Normalize to NFC form on macOS
        use std::ffi::OsString;
        use std::os::unix::ffi::OsStringExt;
        let os_str = path.into_os_string();
        let bytes = os_str.into_vec();
        let normalized: String = String::from_utf8_lossy(&bytes).nfc().collect();
        PathBuf::from(OsString::from_vec(normalized.into_bytes()))
    }
    #[cfg(target_os = "windows")]
    {
        // On Windows, convert to lowercase for case-insensitive handling
        path.to_string_lossy().to_lowercase().into()
    }
}

pub fn pathbuf_to_file_uri(path: PathBuf) -> Result<String, Box<dyn std::error::Error>> {
    let normalized_path = normalize_path(path);
    let url = Url::from_file_path(normalized_path).map_err(|_| "Invalid path for URI conversion")?;
    Ok(url.to_string())
}

pub fn file_uri_to_pathbuf(uri: &str) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let url = Url::parse(uri)?;
    url.to_file_path().map_err(|_| "Invalid file URI".into())
}

impl From<u32> for FileChangeFilter {
    fn from(value: u32) -> Self {
        match value {
            1 => FileChangeFilter::Updated,
            2 => FileChangeFilter::Added,
            4 => FileChangeFilter::Deleted,
            _ => FileChangeFilter::Updated, // Default to updated
        }
    }
}