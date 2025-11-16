/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileStat {
    pub size: u64,
    pub mtime: i64,
    pub ctime: i64,
    pub is_directory: bool,
    pub is_file: bool,
    pub is_symlink: bool,
    pub permissions: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub is_file: bool,
    pub is_symlink: bool,
    pub size: Option<u64>,
    pub mtime: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadFileRequest {
    pub path: String,
    pub encoding: Option<String>, // "utf8", "base64", etc.
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadFileResponse {
    pub content: String,
    pub stat: FileStat,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AtomicWriteOptions {
    pub postfix: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WriteFileRequest {
    pub path: String,
    pub content: String,
    pub encoding: Option<String>,
    pub create_dirs: Option<bool>,
    pub atomic: Option<AtomicWriteOptions>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenFileRequest {
    pub path: String,
    pub create: Option<bool>,
    pub unlock: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenFileResponse {
    pub handle: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloseFileRequest {
    pub handle: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadFileHandleRequest {
    pub handle: u32,
    pub position: Option<u64>,
    pub length: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadFileHandleResponse {
    pub data: Vec<u8>,
    pub bytes_read: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WriteFileHandleRequest {
    pub handle: u32,
    pub position: Option<u64>,
    pub data: Vec<u8>,
    pub offset: u32,
    pub length: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WriteFileHandleResponse {
    pub bytes_written: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadFileStreamRequest {
    pub path: String,
    pub options: Option<ReadFileStreamOptions>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadFileStreamOptions {
    pub start: Option<u64>,
    pub length: Option<u64>,
    pub buffer_size: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadFileStreamResponse {
    pub chunk: Vec<u8>,
    pub done: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloneRequest {
    pub source: String,
    pub destination: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CopyRequest {
    pub source: String,
    pub destination: String,
    pub overwrite: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteRequest {
    pub path: String,
    pub recursive: Option<bool>,
    pub atomic: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatRequest {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadDirRequest {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RealPathRequest {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MkDirRequest {
    pub path: String,
    pub recursive: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenameRequest {
    pub old_path: String,
    pub new_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "method", content = "params")]
pub enum FileIORequest {
    ReadFile(ReadFileRequest),
    WriteFile(WriteFileRequest),
    Copy(CopyRequest),
    Delete(DeleteRequest),
    Stat(StatRequest),
    ReadDir(ReadDirRequest),
    RealPath(RealPathRequest),
    MkDir(MkDirRequest),
    Rename(RenameRequest),
    OpenFile(OpenFileRequest),
    CloseFile(CloseFileRequest),
    ReadFileHandle(ReadFileHandleRequest),
    WriteFileHandle(WriteFileHandleRequest),
    ReadFileStream(ReadFileStreamRequest),
    Clone(CloneRequest),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileIOError {
    pub message: String,
    pub code: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum FileIOResponse {
    ReadFile(ReadFileResponse),
    WriteFile(()),
    Copy(()),
    Delete(()),
    Stat(FileStat),
    ReadDir(Vec<DirEntry>),
    RealPath(String),
    MkDir(()),
    Rename(()),
    OpenFile(OpenFileResponse),
    CloseFile(()),
    ReadFileHandle(ReadFileHandleResponse),
    WriteFileHandle(WriteFileHandleResponse),
    ReadFileStream(ReadFileStreamResponse),
    Clone(()),
    Error(FileIOError),
}