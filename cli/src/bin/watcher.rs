/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use cli::log::{Level, Logger};
use cli::services::ipc::{start_node_ipc_server_with, Base64Serialization};
use cli::services::lifecycle::ParentMonitor;
use cli::services::watcher::service::create_watcher_service;
use cli::services::watcher::types::WatchRequest;
use cli::json_rpc::JsonRpcSerializer;
use cli::rpc::RpcBuilder;
use opentelemetry::trace::TracerProvider;
use std::env;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::join;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    start_ipc_server().await
}

async fn start_ipc_server() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Create notification channel for IPC
    let (notification_tx, notification_rx) = tokio::sync::mpsc::unbounded_channel::<String>();

    // Create IPC sink
    let ipc_sink = Arc::new(move |msg: String| {
        let _ = notification_tx.send(msg);
    });

    // Create watcher service
    let watcher_service = Arc::new(Mutex::new(create_watcher_service(ipc_sink)));

    // Get parent PID from environment
    let parent_pid: u32 = env::var("VSCODE_PARENT_PID")
        .unwrap_or_else(|_| "1".to_string())
        .parse()
        .unwrap_or(1);

    // Set up parent monitor
    let parent_monitor = ParentMonitor::new(parent_pid);

    // Create RPC dispatcher with methods
    let base64_serializer = Base64Serialization::new(JsonRpcSerializer {});
    let rpc_builder = RpcBuilder::new(base64_serializer);

    let mut method_builder = rpc_builder.methods(Arc::new(watcher_service.clone()));
    // watch method - takes array of WatchRequest
    method_builder.register_async("watch", |requests: Vec<WatchRequest>, context| async move {
        let mut service = context.lock().await;
        service.watch(requests).await.map_err(|e| cli::util::errors::AnyError::WrappedError(cli::util::errors::wrapdbg(e, "watch failed")))
    });
    // setVerboseLogging method
    method_builder.register_async("setVerboseLogging", |enabled: bool, context| async move {
        let service = context;
        let service_guard = service.lock().await;
        service_guard.set_verbose_logging(enabled).await;
        Ok(())
    });
    // stop method
    method_builder.register_async("stop", |(), context| async move {
        let service = context;
        let result = service.lock().await.stop().await.map_err(|e| cli::util::errors::AnyError::WrappedError(cli::util::errors::wrapdbg(e, "stop failed")));
        result
    });

    let dispatcher = method_builder.build(Logger::new(
        opentelemetry_sdk::trace::TracerProvider::builder()
            .build()
            .tracer("watcher"),
        Level::Info,
    ));

    // Start IPC server and parent monitoring concurrently
    let ipc_task = tokio::spawn(async move {
        start_node_ipc_server_with(dispatcher, notification_rx).await
    });

    let monitor_task = tokio::spawn(async move {
        parent_monitor.monitor().await
    });

    // Wait for either task to complete
    let result = join!(ipc_task, monitor_task);

    match result {
        (Ok(ipc_result), _) => ipc_result.map_err(Into::into),
        (_, Ok(monitor_result)) => monitor_result.map_err(Into::into),
        (Err(e), _) => Err(Box::new(e)),
    }
}