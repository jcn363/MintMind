/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use std::collections::HashMap;
use std::process::Stdio;
use std::time::Duration;
use tokio::process::Command;
use tokio::time::timeout;

use crate::services::lifecycle::{ServiceConfig, ServiceSpawner, ServiceHandle};

#[tokio::test]
async fn test_service_spawn() {
    let config = ServiceConfig {
        name: "test".to_string(),
        log_level: log::Level::Info,
        parent_pid: std::process::id(),
        env_vars: HashMap::new(),
    };

    let mut handle = ServiceSpawner::spawn(
        &config,
        "cargo",
        &["run".to_string(), "--example".to_string(), "echo_service".to_string()],
    )
    .await
    .unwrap();

    // Verify service is running and PID is tracked
    assert!(handle.is_running().await);
    assert!(handle.pid() > 0);

    // Verify environment is set correctly by checking if service can start
    // (The service will fail if env is not set properly, as it expects MINTMIND_PARENT_PID)
    tokio::time::sleep(Duration::from_millis(100)).await; // Give time to start
    assert!(handle.is_running().await);

    handle.shutdown().await.unwrap();
    let result = timeout(Duration::from_secs(5), handle.wait_for_exit()).await;
    assert!(result.is_ok());
    assert!(!handle.is_running().await);
}

#[tokio::test]
async fn test_parent_monitoring() {
    // Spawn a dummy parent process
    #[cfg(unix)]
    let mut parent_cmd = Command::new("sleep")
        .arg("100")
        .stdout(Stdio::null())
        .spawn()
        .unwrap();
    #[cfg(windows)]
    let mut parent_cmd = Command::new("timeout")
        .arg("/t")
        .arg("100")
        .arg("/nobreak")
        .stdout(Stdio::null())
        .spawn()
        .unwrap();
    let parent_pid = parent_cmd.id().unwrap();

    let config = ServiceConfig {
        name: "test".to_string(),
        log_level: log::Level::Info,
        parent_pid,
        env_vars: HashMap::new(),
    };

    let mut handle = ServiceSpawner::spawn(
        &config,
        "cargo",
        &["run".to_string(), "--example".to_string(), "echo_service".to_string()],
    )
    .await
    .unwrap();

    // Verify service starts
    tokio::time::sleep(Duration::from_millis(100)).await;
    assert!(handle.is_running().await);

    // Kill the dummy parent process
    #[cfg(unix)]
    {
        parent_cmd.kill().await.unwrap();
        let _ = parent_cmd.wait().await;
    }
    #[cfg(windows)]
    {
        use std::process::Command as StdCommand;
        let _ = StdCommand::new("taskkill")
            .arg("/pid")
            .arg(&parent_pid.to_string())
            .arg("/t")
            .arg("/f")
            .output();
        let _ = parent_cmd.wait().await;
    }

    // Service should exit when parent monitoring detects parent death
    let result = timeout(Duration::from_secs(10), handle.wait_for_exit()).await;
    assert!(result.is_ok(), "Service should have exited when parent died");
    assert!(!handle.is_running().await);
}

#[cfg(unix)]
#[tokio::test]
async fn test_graceful_shutdown_unix() {
    let config = ServiceConfig {
        name: "test".to_string(),
        log_level: log::Level::Info,
        parent_pid: std::process::id(),
        env_vars: HashMap::new(),
    };

    let mut handle = ServiceSpawner::spawn(
        &config,
        "cargo",
        &["run".to_string(), "--example".to_string(), "echo_service".to_string()],
    )
    .await
    .unwrap();

    // Verify service starts
    tokio::time::sleep(Duration::from_millis(100)).await;
    assert!(handle.is_running().await);

    // Send SIGTERM for graceful shutdown
    let kill_result = Command::new("kill")
        .arg("-TERM")
        .arg(handle.pid().to_string())
        .status()
        .await
        .unwrap();
    assert!(kill_result.success());

    // Service should exit gracefully within timeout
    let result = timeout(Duration::from_secs(5), handle.wait_for_exit()).await;
    assert!(result.is_ok(), "Service should have exited gracefully on SIGTERM");
    assert!(!handle.is_running().await);
}

#[cfg(windows)]
#[tokio::test]
async fn test_graceful_shutdown_windows() {
    let config = ServiceConfig {
        name: "test".to_string(),
        log_level: log::Level::Info,
        parent_pid: std::process::id(),
        env_vars: HashMap::new(),
    };

    let mut handle = ServiceSpawner::spawn(
        &config,
        "cargo",
        &["run".to_string(), "--example".to_string(), "echo_service".to_string()],
    )
    .await
    .unwrap();

    // Verify service starts
    tokio::time::sleep(Duration::from_millis(100)).await;
    assert!(handle.is_running().await);

    // Use taskkill to send termination signal
    let kill_result = Command::new("taskkill")
        .arg("/pid")
        .arg(handle.pid().to_string())
        .arg("/t")
        .status()
        .await
        .unwrap();
    assert!(kill_result.success());

    // Service should exit within timeout
    let result = timeout(Duration::from_secs(5), handle.wait_for_exit()).await;
    assert!(result.is_ok(), "Service should have exited on taskkill");
    assert!(!handle.is_running().await);
}

#[tokio::test]
async fn test_service_restart() {
    let config = ServiceConfig {
        name: "test".to_string(),
        log_level: log::Level::Info,
        parent_pid: std::process::id(),
        env_vars: HashMap::new(),
    };

    // Spawn initial service
    let mut handle1 = ServiceSpawner::spawn(
        &config,
        "cargo",
        &["run".to_string(), "--example".to_string(), "echo_service".to_string()],
    )
    .await
    .unwrap();

    tokio::time::sleep(Duration::from_millis(100)).await;
    assert!(handle1.is_running().await);
    let pid1 = handle1.pid();

    // Simulate crash by killing the service
    handle1.shutdown().await.unwrap();
    let result = timeout(Duration::from_secs(5), handle1.wait_for_exit()).await;
    assert!(result.is_ok());
    assert!(!handle1.is_running().await);

    // Restart the service
    let mut handle2 = ServiceSpawner::spawn(
        &config,
        "cargo",
        &["run".to_string(), "--example".to_string(), "echo_service".to_string()],
    )
    .await
    .unwrap();

    tokio::time::sleep(Duration::from_millis(100)).await;
    assert!(handle2.is_running().await);
    let pid2 = handle2.pid();

    // Verify it's a different process instance
    assert_ne!(pid1, pid2);

    handle2.shutdown().await.unwrap();
    let result = timeout(Duration::from_secs(5), handle2.wait_for_exit()).await;
    assert!(result.is_ok());
    assert!(!handle2.is_running().await);
}

#[tokio::test]
async fn test_multiple_services() {
    let config = ServiceConfig {
        name: "test".to_string(),
        log_level: log::Level::Info,
        parent_pid: std::process::id(),
        env_vars: HashMap::new(),
    };

    // Spawn multiple services concurrently
    let mut handles = Vec::new();
    for i in 0..3 {
        let mut env_vars = HashMap::new();
        env_vars.insert("SERVICE_ID".to_string(), i.to_string());

        let service_config = ServiceConfig {
            name: format!("test-{}", i),
            log_level: log::Level::Info,
            parent_pid: std::process::id(),
            env_vars,
        };

        let handle = ServiceSpawner::spawn(
            &service_config,
            "cargo",
            &["run".to_string(), "--example".to_string(), "echo_service".to_string()],
        )
        .await
        .unwrap();

        handles.push(handle);
    }

    // Verify all services are running concurrently
    tokio::time::sleep(Duration::from_millis(200)).await;
    for handle in &handles {
        assert!(handle.is_running().await);
    }

    // Verify PIDs are unique
    let pids: Vec<u32> = handles.iter().map(|h| h.pid()).collect();
    let unique_pids: std::collections::HashSet<u32> = pids.iter().cloned().collect();
    assert_eq!(pids.len(), unique_pids.len());

    // Shutdown all services
    for mut handle in handles {
        handle.shutdown().await.unwrap();
        let result = timeout(Duration::from_secs(5), handle.wait_for_exit()).await;
        assert!(result.is_ok());
        assert!(!handle.is_running().await);
    }
#[cfg(unix)]
#[tokio::test]
async fn test_service_handle_is_running_unix() {
    let config = ServiceConfig {
        name: "test".to_string(),
        log_level: log::Level::Info,
        parent_pid: std::process::id(),
        env_vars: HashMap::new(),
    };

    let mut handle = ServiceSpawner::spawn(
        &config,
        "cargo",
        &["run".to_string(), "--example".to_string(), "echo_service".to_string()],
    )
    .await
    .unwrap();

    // Verify service is running
    tokio::time::sleep(Duration::from_millis(100)).await;
    assert!(handle.is_running().await);

    handle.shutdown().await.unwrap();
    let result = timeout(Duration::from_secs(5), handle.wait_for_exit()).await;
    assert!(result.is_ok());
    assert!(!handle.is_running().await);
}

#[cfg(unix)]
#[tokio::test]
async fn test_parent_monitor_unix() {
    // Spawn a dummy parent process
    let mut parent_cmd = Command::new("sleep")
        .arg("10")
        .stdout(Stdio::null())
        .spawn()
        .unwrap();
    let parent_pid = parent_cmd.id().unwrap();

    let monitor = crate::services::lifecycle::ParentMonitor::new(parent_pid);

    // Start monitoring in a separate task
    let monitor_handle = tokio::spawn(async move {
        monitor.monitor().await
    });

    // Kill the dummy parent process after a short delay
    tokio::time::sleep(Duration::from_millis(100)).await;
    parent_cmd.kill().await.unwrap();
    let _ = parent_cmd.wait().await;

    // Monitor should detect parent death and return an error
    let result = timeout(Duration::from_secs(10), monitor_handle).await;
    assert!(result.is_ok());
    assert!(result.unwrap().is_err());
}
}
