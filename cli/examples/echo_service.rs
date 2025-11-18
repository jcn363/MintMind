/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use std::env;
use tokio::signal;

use crate::{
    log::Level,
    rpc::{RpcBuilder, RpcMethodBuilder},
    services::{ipc::start_node_ipc_server, lifecycle::ParentMonitor, logging::create_ipc_logger},
    util::errors::AnyError,
};

/// Simple echo service demonstrating the complete integration pattern.
/// This serves as a reference implementation for new backend services.
pub struct EchoService;

impl EchoService {
    /// Echo RPC method that returns the input message prefixed with "Echo: "
    pub fn echo(&self, message: String) -> Result<String, AnyError> {
        Ok(format!("Echo: {}", message))
    }
}

#[tokio::main]
async fn main() -> Result<(), AnyError> {
    // Get parent PID for monitoring
    let parent_pid = env::var("MINTMIND_PARENT_PID")
        .unwrap_or_else(|_| "1".to_string())
        .parse::<u32>()
        .unwrap_or(1);

    // Create IPC logging channel
    let (log_tx, _) = tokio::sync::mpsc::unbounded_channel();

    // Set up logging with IPC forwarding
    let logger = create_ipc_logger(log_tx, Level::Info);

    // Create RPC builder with service context
    let echo_service = EchoService;
    let mut rpc_builder = RpcBuilder::new(crate::json_rpc::JsonRpcSerializer {});
    let mut method_builder: RpcMethodBuilder<_, EchoService> =
        rpc_builder.methods(echo_service);

    // Register the echo method
    method_builder.register_sync("echo", |message: String, service: &EchoService| {
        service.echo(message)
    })?;

    // Build the dispatcher
    let dispatcher = method_builder.build(logger);

    // Set up parent process monitoring
    let monitor = ParentMonitor::new(parent_pid);

    // Start IPC server in background
    let ipc_handle = tokio::spawn(async move {
        start_node_ipc_server_with(dispatcher).await
    });

    // Start parent monitoring in background
    let monitor_handle = tokio::spawn(async move {
        monitor.monitor().await
    });

    // Set up graceful shutdown signal handling
    let shutdown_signal = async {
        let ctrl_c = async {
            signal::ctrl_c()
                .await
                .expect("failed to listen for ctrl+c");
        };

        let terminate = async {
            signal::unix::signal(signal::unix::SignalKind::terminate())
                .expect("failed to listen for SIGTERM")
                .recv()
                .await;
        };

        tokio::select! {
            _ = ctrl_c => {},
            _ = terminate => {},
        }
    };

    // Clone logger for shutdown logging
    let shutdown_logger = logger.clone();

    // Run until shutdown signal or parent dies
    tokio::select! {
        _ = shutdown_signal => {
            info!(shutdown_logger, "Received shutdown signal, exiting gracefully");
        }
        result = monitor_handle => {
            match result {
                Ok(Ok(())) => info!(shutdown_logger, "Parent process monitoring completed"),
                Ok(Err(e)) => error!(shutdown_logger, "Parent process monitoring failed: {:?}", e),
                Err(e) => error!(shutdown_logger, "Parent monitoring task panicked: {:?}", e),
            }
        }
    }

    // IPC server should shut down naturally when stdin closes
    let _ = ipc_handle.await;

    Ok(())
}
