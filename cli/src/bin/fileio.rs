/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use clap::Parser;
use opentelemetry_sdk::trace::SdkTracerProvider;
use opentelemetry::trace::TracerProvider;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::io::{stdin, stdout, BufReader, BufWriter};

use cli::{
    info,
    json_rpc::{new_json_rpc, start_json_rpc},
    log::{self, Level},
    services::fileio::{start_fileio_service, handle_fileio_request},
};

#[derive(Parser)]
#[command(name = "fileio")]
#[command(about = "File I/O service binary")]
struct Args {
    #[arg(long, default_value = "info")]
    log_level: Level,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let args = Args::parse();

    // Initialize logging
    let tracer = SdkTracerProvider::builder()
        .build()
        .tracer("fileio");
    let logger = log::Logger::new(tracer, args.log_level);
    log::install_global_logger(logger.clone());

    info!(logger, "Starting FileIO service");

    // Create the IPC sink for sending responses
    let (tx, rx) = tokio::sync::mpsc::unbounded_channel::<Vec<u8>>();
    let ipc_sink = Arc::new(move |message: String| {
        let tx = tx.clone();
        tokio::spawn(async move {
            let _ = tx.send(message.into_bytes());
        });
    });

    // Start the FileIO service
    let service = start_fileio_service(ipc_sink).await;
    let service = Arc::new(Mutex::new(service));

    // Set up JSON-RPC
    let builder = new_json_rpc();
    let mut methods = builder.methods(service.clone());

    // Register the FileIO request handler
    methods.register_async("onFileIORequest", |req, service| {
        let service = service.clone();
        async move {
            handle_fileio_request(&service, &req).await.map_err(|e| cli::util::errors::AnyError::WrappedError(cli::util::errors::wrapdbg(e, "fileio request failed")))
        }
    });

    let dispatcher = methods.build(logger.clone());

    // Set up IPC channels
    let (shutdown_rx, shutdown_tx) = cli::util::sync::new_barrier::<()>();

    // Start the JSON-RPC loop with stdin/stdout
    let read = BufReader::new(stdin());
    let write = BufWriter::new(stdout());

    let join_handle = tokio::spawn(async move {
        start_json_rpc(dispatcher, read, write, rx, shutdown_rx).await
    });

    // Wait for shutdown signal (e.g., SIGINT)
    tokio::signal::ctrl_c().await?;
    info!(logger, "Received shutdown signal, stopping FileIO service");
    shutdown_tx.open(());

    // Wait for the RPC loop to finish
    let _ = join_handle.await?;

    Ok(())
}