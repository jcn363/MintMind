/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

pub mod locks;
pub mod operations;
pub mod platform;
pub mod service;
pub mod types;

pub use service::FileIOService;
pub use types::{FileIORequest, FileIOResponse};

use serde_json;
use std::sync::Arc;
use tokio::sync::Mutex;

/// Start the file I/O service and return a handle for IPC communication
pub async fn start_fileio_service(ipc_sink: Arc<dyn Fn(String) + Send + Sync>) -> FileIOService {
    FileIOService::new(ipc_sink)
}

/// Handle an IPC request for file I/O operations
pub async fn handle_fileio_request(
    service: &Arc<Mutex<FileIOService>>,
    request: &crate::rpc::RequestParams<FileIORequest>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let service = service.lock().await;
    service.handle_request(request).await
}