/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use crate::services::fileio::{
    locks::ResourceLockManager,
    operations,
    types::{FileIOError, FileIOResponse, FileIORequest},
};
use serde_json;
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct FileIOService {
    lock_manager: Mutex<ResourceLockManager>,
    ipc_sink: Arc<dyn Fn(String) + Send + Sync>,
}

impl FileIOService {
    pub fn new(ipc_sink: Arc<dyn Fn(String) + Send + Sync>) -> Self {
        FileIOService {
            lock_manager: Mutex::new(ResourceLockManager::new()),
            ipc_sink,
        }
    }

    pub async fn handle_request(&self, request: &crate::rpc::RequestParams<FileIORequest>) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let fileio_request: FileIORequest = request.params.clone();

        let response = match self.process_request(fileio_request).await {
            Ok(response) => response,
            Err(e) => {
                let error = FileIOError {
                    message: e.to_string(),
                    code: Self::map_error_to_code(&e),
                };
                FileIOResponse::Error(error)
            }
        };

        // Create structured response object matching the RPC protocol
        let structured_response = serde_json::json!({
            "method": "onFileIOResponse",
            "params": response
        });

        let message = serde_json::to_string(&structured_response)?;

        (self.ipc_sink)(message);
        Ok(())
    }

    async fn process_request(&self, request: FileIORequest) -> Result<FileIOResponse, Box<dyn std::error::Error + Send + Sync>> {
        match request {
            FileIORequest::ReadFile(req) => {
                // Acquire lock for reading
                let _lock = self.lock_manager.lock().await.acquire_lock(&req.path).await?;
                let result = operations::read_file(req).await?;
                Ok(FileIOResponse::ReadFile(result))
            }
            FileIORequest::WriteFile(req) => {
                // Acquire lock for writing
                let _lock = self.lock_manager.lock().await.acquire_lock(&req.path).await?;
                operations::write_file(req).await?;
                Ok(FileIOResponse::WriteFile(()))
            }
            FileIORequest::Copy(req) => {
                // Acquire locks for both source and destination
                let mut locks = self.lock_manager.lock().await;
                let _source_lock = locks.acquire_lock(&req.source).await?;
                let _dest_lock = locks.acquire_lock(&req.destination).await?;
                operations::copy(req).await?;
                Ok(FileIOResponse::Copy(()))
            }
            FileIORequest::Delete(req) => {
                // Acquire lock for deletion
                let _lock = self.lock_manager.lock().await.acquire_lock(&req.path).await?;
                operations::delete(req).await?;
                Ok(FileIOResponse::Delete(()))
            }
            FileIORequest::Stat(req) => {
                let result = operations::stat(req).await?;
                Ok(FileIOResponse::Stat(result))
            }
            FileIORequest::ReadDir(req) => {
                let result = operations::readdir(req).await?;
                Ok(FileIOResponse::ReadDir(result))
            }
            FileIORequest::RealPath(req) => {
                let result = operations::realpath(req).await?;
                Ok(FileIOResponse::RealPath(result))
            }
            FileIORequest::MkDir(req) => {
                operations::mkdir(req).await?;
                Ok(FileIOResponse::MkDir(()))
            }
            FileIORequest::Rename(req) => {
                // Acquire locks for both paths
                let mut locks = self.lock_manager.lock().await;
                let _old_lock = locks.acquire_lock(&req.old_path).await?;
                let _new_lock = locks.acquire_lock(&req.new_path).await?;
                operations::rename(req).await?;
                Ok(FileIOResponse::Rename(()))
            }
            FileIORequest::OpenFile(req) => {
                // Acquire lock for the file being opened
                let _lock = self.lock_manager.lock().await.acquire_lock(&req.path).await?;
                let result = operations::open_file(req).await?;
                Ok(FileIOResponse::OpenFile(result))
            }
            FileIORequest::CloseFile(req) => {
                operations::close_file(req).await?;
                Ok(FileIOResponse::CloseFile(()))
            }
            FileIORequest::ReadFileHandle(req) => {
                let result = operations::read_file_handle(req).await?;
                Ok(FileIOResponse::ReadFileHandle(result))
            }
            FileIORequest::WriteFileHandle(req) => {
                let result = operations::write_file_handle(req).await?;
                Ok(FileIOResponse::WriteFileHandle(result))
            }
            FileIORequest::ReadFileStream(req) => {
                let result = operations::read_file_stream(req).await?;
                Ok(FileIOResponse::ReadFileStream(result))
            }
            FileIORequest::Clone(req) => {
                // Acquire locks for both source and destination
                let mut locks = self.lock_manager.lock().await;
                let _source_lock = locks.acquire_lock(&req.source).await?;
                let _dest_lock = locks.acquire_lock(&req.destination).await?;
                operations::clone_file(req).await?;
                Ok(FileIOResponse::Clone(()))
            }
        }
    }

    fn map_error_to_code(e: &Box<dyn std::error::Error + Send + Sync>) -> String {
        let error_string = e.to_string().to_lowercase();

        if error_string.contains("permission denied") {
            "EPERM".to_string()
        } else if error_string.contains("no such file or directory") {
            "ENOENT".to_string()
        } else if error_string.contains("is a directory") {
            "EISDIR".to_string()
        } else if error_string.contains("not a directory") {
            "ENOTDIR".to_string()
        } else if error_string.contains("file exists") {
            "EEXIST".to_string()
        } else if error_string.contains("disk") && error_string.contains("full") {
            "ENOSPC".to_string()
        } else if error_string.contains("too many") {
            "EMFILE".to_string()
        } else if error_string.contains("invalid") {
            "EINVAL".to_string()
        } else {
            "EIO".to_string()
        }
    }
}