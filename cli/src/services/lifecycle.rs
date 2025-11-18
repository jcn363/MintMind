/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use std::collections::HashMap;
use std::time::Duration;
use tokio::process::{Child, Command};
use tokio::sync::mpsc;
use tokio::time::interval;

use crate::util::command::{kill_tree, new_tokio_command};
use crate::util::errors::CodeError;
use crate::util::sync::Barrier;

#[derive(Clone, Debug)]
pub struct ServiceConfig {
    pub name: String,
    pub log_level: log::Level,
    pub parent_pid: u32,
    pub env_vars: HashMap<String, String>,
}

pub struct ServiceHandle {
    child: Child,
    pid: u32,
}

impl ServiceHandle {
    pub fn new(child: Child) -> Self {
        let pid = child.id().expect("Child should have a PID");
        Self { child, pid }
    }

    pub async fn wait_for_exit(&mut self) -> Result<(), CodeError> {
        self.child.wait().await.map_err(|e| CodeError::CommandFailed {
            command: format!("service process {}", self.pid),
            code: -1,
            output: e.to_string(),
        })?;
        Ok(())
    }

    pub async fn shutdown(&mut self) -> Result<(), CodeError> {
        kill_tree(self.pid).await
    }

    #[cfg(unix)]
    pub async fn is_running(&self) -> bool {
        let result = Command::new("kill")
            .args(&["-0", &self.pid.to_string()])
            .output()
            .await;

        match result {
            Ok(output) => output.status.success(),
            Err(_) => false,
        }
    }

    pub fn pid(&self) -> u32 {
        self.pid
    }
}

#[cfg(windows)]
impl ServiceHandle {
    pub async fn is_running(&self) -> bool {
        // On Windows, use a different approach to check if process is running
        use crate::util::machine::process_exists;
        process_exists(self.pid)
    }
}

pub struct ServiceSpawner;

impl ServiceSpawner {
    pub async fn spawn(
        config: &ServiceConfig,
        command: &str,
        args: &[String],
    ) -> Result<ServiceHandle, CodeError> {
        let mut cmd = new_tokio_command(command);

        // Set up environment variables
        cmd.env("MINTMIND_PARENT_PID", config.parent_pid.to_string());
        cmd.env("RUST_LOG", format!("{}", config.log_level));

        // Add additional environment variables
        for (key, value) in &config.env_vars {
            cmd.env(key, value);
        }

        // Add args
        cmd.args(args);

        // Spawn the process
        let child = cmd.spawn().map_err(|e| CodeError::CommandFailed {
            command: format!("{} {}", command, args.join(" ")),
            code: -1,
            output: e.to_string(),
        })?;

        Ok(ServiceHandle::new(child))
    }
}

pub struct ParentMonitor {
    parent_pid: u32,
    interval_duration: Duration,
}

impl ParentMonitor {
    pub fn new(parent_pid: u32) -> Self {
        Self {
            parent_pid,
            interval_duration: Duration::from_secs(5),
        }
    }

    #[cfg(unix)]
    pub async fn monitor(&self) -> Result<(), CodeError> {
        let mut interval = interval(self.interval_duration);

        loop {
            interval.tick().await;

            // Check if parent process is still alive using kill(pid, 0) pattern
            let result = Command::new("kill")
                .args(&["-0", &self.parent_pid.to_string()])
                .output()
                .await;

            match result {
                Ok(output) if output.status.success() => {
                    // Parent is alive, continue monitoring
                    continue;
                }
                _ => {
                    // Parent is dead or error occurred, exit monitoring
                    return Err(CodeError::CommandFailed {
                        command: format!("parent process check for {}", self.parent_pid),
                        code: -1,
                        output: "Parent process not found".to_string(),
                    });
                }
            }
        }
    }
}

#[cfg(windows)]
impl ParentMonitor {
    pub async fn monitor(&self) -> Result<(), CodeError> {
        use crate::util::machine::process_exists;

        let mut interval = interval(self.interval_duration);

        loop {
            interval.tick().await;

            if !process_exists(self.parent_pid) {
                return Err(CodeError::CommandFailed {
                    command: format!("parent process check for {}", self.parent_pid),
                    code: -1,
                    output: "Parent process not found".to_string(),
                });
            }
        }
    }
}

pub struct GracefulShutdown {
    shutdown_tx: mpsc::Sender<()>,
    shutdown_rx: mpsc::Receiver<()>,
    barrier: Barrier<()>,
}

impl GracefulShutdown {
    pub fn new() -> (Self, Barrier<()>) {
        let (shutdown_tx, shutdown_rx) = mpsc::channel(1);
        let (_barrier, _barrier_opener) = crate::util::sync::new_barrier();

        (
            Self {
                shutdown_tx,
                shutdown_rx,
                barrier: _barrier.clone(),
            },
            _barrier,
        )
    }

    pub async fn wait_for_shutdown_signal(&mut self) {
        let _ = self.shutdown_rx.recv().await;
    }

    pub async fn shutdown_all(&self) {
        let _ = self.shutdown_tx.send(()).await;
    }

    pub fn barrier(&self) -> &Barrier<()> {
        &self.barrier
    }
}
