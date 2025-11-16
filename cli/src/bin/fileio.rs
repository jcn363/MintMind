/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use clap::Parser;
use serde_json;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::io::{stdin, stdout, BufReader, BufWriter};

use cli::{
    json_rpc::{new_json_rpc, start_json_rpc},
    log::{self, Level},
    services::fileio::{start_fileio_service, handle_fileio_request, FileIOService},
    util::sync::Barrier,
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
    let tracer = opentelemetry_sdk::trace::TracerProvider::builder()
        .build()
        .tracer("fileio");
    let mut logger = log::Logger::new(tracer, args.log_level);
    log::install_global_logger(logger.clone());

    info!(logger, "Starting FileIO service");

    // Create the IPC sink for sending responses
    let (tx, mut rx) = tokio::sync::mpsc::channel::<String>(32);
    let ipc_sink = Arc::new(move |message: String| {
        let tx = tx.clone();
        tokio::spawn(async move {
            let _ = tx.send(message).await;
        });
    });

    // Start the FileIO service
    let service = start_fileio_service(ipc_sink).await;
    let service = Arc::new(Mutex::new(service));

    // Set up JSON-RPC
    let mut builder = new_json_rpc();
    let methods = builder.methods(service.clone());

    // Register the FileIO request handler
    methods.register_async("onFileIORequest", |req, service| {
        let service = service.clone();
        async move {
            handle_fileio_request(&service, &req).await
        }
    });

    let dispatcher = methods.build(logger);

    // Set up IPC channels
    let (shutdown_tx, shutdown_rx) = Barrier::new();

    // Start the JSON-RPC loop with stdin/stdout
    let read = BufReader::new(stdin());
    let write = BufWriter::new(stdout());

    let join_handle = tokio::spawn(async move {
        start_json_rpc(dispatcher, read, write, rx, shutdown_rx).await
    });

    // Wait for shutdown signal (e.g., SIGINT)
    tokio::signal::ctrl_c().await?;
    info!(logger, "Received shutdown signal, stopping FileIO service");
    shutdown_tx.open();

    // Wait for the RPC loop to finish
    let _ = join_handle.await?;

    Ok(())
}