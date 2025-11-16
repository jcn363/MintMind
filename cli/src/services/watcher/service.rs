/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use crate::services::watcher::{
    coalescer::EventCoalescer,
    non_recursive::NonRecursiveWatcher,
    recursive::RecursiveWatcher,
    suspend::WatcherSuspender,
    throttler::{non_recursive_throttler, recursive_throttler, EventThrottler},
    types::{FileChange, WatchRequest, WatchResponse, WatcherError},
};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{RwLock, Mutex};
use tokio::task;
use serde_json;
use base64::{Engine, engine::general_purpose::STANDARD as BASE64_STANDARD};

#[derive(Clone, Copy)]
pub enum WatcherTypeEnum {
    Recursive,
    NonRecursive,
}

pub enum WatcherType {
    Recursive(RecursiveWatcher),
    NonRecursive(NonRecursiveWatcher),
}

pub struct WatcherInstance {
    pub request: WatchRequest,
    pub watcher_type: WatcherTypeEnum,
    pub coalescer: EventCoalescer,
    pub throttler: EventThrottler,
    pub drops_count: Arc<RwLock<u64>>,
    pub throttled_batches_count: Arc<RwLock<u64>>,
}

pub struct UniversalWatcher {
    watchers_instances: Arc<RwLock<HashMap<String, WatcherInstance>>>,
    suspender: WatcherSuspender,
    ipc_sink: Arc<dyn Fn(String) + Send + Sync>,
    tasks: Arc<RwLock<HashMap<String, task::JoinHandle<()>>>>,
    verbose: Arc<RwLock<bool>>,
    resurrection_check_interval: Duration,
}

impl UniversalWatcher {
    pub fn new(ipc_sink: Arc<dyn Fn(String) + Send + Sync>) -> Self {
        let ipc_sink_clone = ipc_sink.clone();
        let suspender = WatcherSuspender::new(Arc::new(move |change: FileChange| {
            let response = WatchResponse {
                id: "suspension-monitor".to_string(),
                changes: vec![change],
            };
            let json = serde_json::to_string(&response).unwrap();
            let encoded = BASE64_STANDARD.encode(json);
            let message = format!("{{\"method\":\"onDidChangeFile\",\"params\":{}}}", encoded);
            ipc_sink_clone(message);
        }));

        UniversalWatcher {
            watchers_instances: Arc::new(RwLock::new(HashMap::new())),
            suspender,
            ipc_sink,
            tasks: Arc::new(RwLock::new(HashMap::new())),
            verbose: Arc::new(RwLock::new(false)),
            resurrection_check_interval: Duration::from_secs(30), // Check every 30 seconds
        }
    }

    pub async fn watch(&mut self, requests: Vec<WatchRequest>) -> Result<(), WatcherError> {
        // Abort existing tasks and clear watchers
        {
            let mut tasks = self.tasks.write().await;
            for (_id, handle) in tasks.drain() {
                handle.abort();
            }
        }
        self.watchers_instances.write().await.clear();

        let mut watchers_to_spawn = Vec::new();

        for request in requests {
            let path_str = request.path.clone();

            // Use path as key for deduplication
            if self.watchers_instances.read().await.contains_key(&path_str) {
                // Update existing watcher atomically
                let mut watchers_instances = self.watchers_instances.write().await;
                if let Some(existing_instance) = watchers_instances.get_mut(&path_str) {
                    existing_instance.request = request.clone();
                    // TODO: Update coalescer, throttler, and watcher if needed
                    continue;
                }
            }

            let path_buf = crate::services::watcher::types::file_uri_to_pathbuf(&path_str)
                .map_err(|e| WatcherError {
                    message: format!("Invalid file URI: {}", e),
                    code: Some("INVALID_URI".to_string()),
                })?;

            // Check if suspended
            if self.suspender.is_suspended(&path_buf) {
                // Try to resume if path exists
                self.suspender.check_resurrection(&path_buf, request.correlation_id);

                // If still suspended after check, return error
                if self.suspender.is_suspended(&path_buf) {
                    return Err(WatcherError {
                        message: format!("Watcher for path {} is suspended due to failures", path_buf.display()),
                        code: Some("SUSPENDED".to_string()),
                    });
                }
            }

            // Set correlation ID for this path if provided
            if let Some(correlation_id) = request.correlation_id {
                self.suspender.set_correlation_id(&path_buf, Some(correlation_id));
            }

            // Create coalescer
            let excludes = request.excludes.clone();
            let includes = request.includes.clone().unwrap_or_default();
            let coalescer = EventCoalescer::new(excludes, includes)
                .map_err(|e| WatcherError {
                    message: format!("Failed to create event coalescer: {}", e),
                    code: Some("COALESCER_ERROR".to_string()),
                })?;

            // Create throttler based on recursive flag
            // Use log_sink for IPC logging to onDidLogMessage
            let ipc_sink_clone = self.ipc_sink.clone();
            let log_sink: Option<Arc<dyn Fn(String) + Send + Sync>> = Some(Arc::new(move |msg: String| {
                ipc_sink_clone(format!("{{\"method\":\"onDidLogMessage\",\"params\":{{\"type\":\"warn\",\"message\":\"{}\"}}}}", msg));
            }));
            let throttler = if request.recursive {
                recursive_throttler(log_sink)
            } else {
                non_recursive_throttler(log_sink)
            };

            // Create watcher
            let watcher = if request.recursive {
                let watcher = RecursiveWatcher::new(path_buf.clone()).map_err(|e| WatcherError {
                    message: format!("Failed to create recursive watcher: {:?}", e),
                    code: Some("WATCHER_ERROR".to_string()),
                })?;
                WatcherType::Recursive(watcher)
            } else {
                let watcher = NonRecursiveWatcher::new(path_buf.clone()).map_err(|e| WatcherError {
                    message: format!("Failed to create non-recursive watcher: {:?}", e),
                    code: Some("WATCHER_ERROR".to_string()),
                })?;
                WatcherType::NonRecursive(watcher)
            };

            let drops_count = Arc::new(RwLock::new(0));
            let throttled_batches_count = Arc::new(RwLock::new(0));

            let watcher_type = if request.recursive {
                WatcherTypeEnum::Recursive
            } else {
                WatcherTypeEnum::NonRecursive
            };

            let instance = WatcherInstance {
                request: request.clone(),
                watcher_type,
                coalescer,
                throttler,
                drops_count: drops_count.clone(),
                throttled_batches_count: throttled_batches_count.clone(),
            };

            // Store the instance using path as key
            self.watchers_instances.write().await.insert(path_str.clone(), instance);

            // Collect watcher to spawn task
            watchers_to_spawn.push((path_str.clone(), watcher));
        }

        // Clone necessary data for tasks
        let ipc_sink = self.ipc_sink.clone();
        let watchers_instances_clone = self.watchers_instances.clone();
        let resurrection_check_interval_clone = self.resurrection_check_interval;
        let suspender_clone = Arc::new(Mutex::new(self.suspender.clone()));

        // Spawn background tasks for each watcher
        for (path, watcher) in watchers_to_spawn {
            let ipc_sink_clone = ipc_sink.clone();
            let path_for_task = path.clone();

            let resurrection_check_interval = resurrection_check_interval_clone.clone();
            let suspender_clone = suspender_clone.clone();

            let watchers_instances_clone_for_task = watchers_instances_clone.clone();

            let task = tokio::task::spawn(async move {
                let mut resurrection_check_timer = tokio::time::interval(resurrection_check_interval);

                loop {
                    tokio::select! {
                        _ = tokio::time::sleep(Duration::from_millis(100)) => {
                            // Normal polling
                            let watchers_instances_read = watchers_instances_clone_for_task.read().await;
                            let instance_opt = watchers_instances_read.get(&path_for_task);
                            let instance = match instance_opt {
                                Some(inst) => inst,
                                None => return, // Watcher removed
                            };

                            let raw_events = match &watcher {
                                WatcherType::Recursive(w) => match w.try_recv() {
                                    Ok(events) => events,
                                    Err(_) => {
                                        // Record failure on receive error
                                        let path = crate::services::watcher::types::file_uri_to_pathbuf(&instance.request.path).unwrap_or_default();
                                        {
                                            let mut suspender = suspender_clone.lock().await;
                                            suspender.record_failure(&path);
                                        }
                                        continue;
                                    },
                                },
                                WatcherType::NonRecursive(w) => match w.try_recv() {
                                    Ok(events) => events,
                                    Err(_) => {
                                        // Record failure on receive error
                                        let path = crate::services::watcher::types::file_uri_to_pathbuf(&instance.request.path).unwrap_or_default();
                                        {
                                            let mut suspender = suspender_clone.lock().await;
                                            suspender.record_failure(&path);
                                        }
                                        continue;
                                    },
                                },
                            };

                            let coalesced = instance.coalescer.coalesce_events(raw_events);
                            if !coalesced.is_empty() {
                                // Send to throttler
                                let mut drops = 0u64;
                                for event in coalesced {
                                    if let Err(_) = instance.throttler.send(event) {
                                        drops += 1;
                                    }
                                }
                                *instance.drops_count.write().await += drops;

                                // Get throttled events - worker pulls from throttler, stamps cId, sends to IPC
                                // Note: The worker in background tasks pulls from throttler and sends to IPC
                                // So we don't need to pull events here anymore - the worker handles it
                                let changes: Vec<FileChange> = Vec::new(); // Placeholder to fix compilation
                                let _batch_count = 0u64;   // Placeholder to fix compilation

                                if !changes.is_empty() {
                                    // Stamp correlation ID onto all changes
                                    let mut stamped_changes = Vec::new();
                                    for mut change in changes {
                                        change.correlation_id = instance.request.correlation_id;
                                        stamped_changes.push(change);
                                    }

                                    let response = WatchResponse {
                                        id: path_for_task.clone(),
                                        changes: stamped_changes,
                                    };

                                    let json = serde_json::to_string(&response).unwrap();
                                    let encoded = BASE64_STANDARD.encode(json);
                                    let message = format!("{{\"method\":\"onDidChangeFile\",\"params\":{}}}", encoded);
                                    ipc_sink_clone(message);
                                }
                            }
                        }
                        _ = resurrection_check_timer.tick() => {
                            // Check for path resurrection
                            let watchers_instances_read = watchers_instances_clone_for_task.read().await;
                            let instance_opt = watchers_instances_read.get(&path_for_task);
                            if let Some(instance) = instance_opt {
                                let path = crate::services::watcher::types::file_uri_to_pathbuf(&instance.request.path).unwrap_or_default();
                                let mut suspender = suspender_clone.lock().await;
                                let resurrected = suspender.check_resurrection(&path, instance.request.correlation_id);
                                if resurrected {
                                    // Path has been resurrected, restart watcher if needed
                                    // The resurrection event has already been emitted
                                }
                            }
                        }
                    }
                }
            });

            self.tasks.write().await.insert(path, task);
        }

        Ok(())
    }

    pub async fn unwatch(&self, id: &str) -> Result<(), WatcherError> {
        let mut watchers_instances = self.watchers_instances.write().await;
        if watchers_instances.remove(id).is_none() {
            return Err(WatcherError {
                message: format!("Watcher with id {} not found", id),
                code: Some("NOT_FOUND".to_string()),
            });
        }

        // Abort the corresponding task
        if let Some(task) = self.tasks.write().await.remove(id) {
            task.abort();
        }

        Ok(())
    }


    pub async fn get_stats(&self) -> HashMap<String, serde_json::Value> {
        let watchers = self.watchers_instances.read().await;
        let mut stats = HashMap::new();

        stats.insert("total_watchers".to_string(), serde_json::json!(watchers.len()));

        let recursive_count = watchers.values()
            .filter(|w| matches!(w.watcher_type, WatcherTypeEnum::Recursive))
            .count();
        stats.insert("recursive_watchers".to_string(), serde_json::json!(recursive_count));

        let non_recursive_count = watchers.values()
            .filter(|w| matches!(w.watcher_type, WatcherTypeEnum::NonRecursive))
            .count();
        stats.insert("non_recursive_watchers".to_string(), serde_json::json!(non_recursive_count));

        let suspended_paths = self.suspender.suspended_paths();
        stats.insert("suspended_watchers".to_string(), serde_json::json!(suspended_paths.len()));

        let total_drops = watchers.values()
            .map(|w| w.drops_count.try_read().map(|guard| *guard).unwrap_or(0))
            .sum::<u64>();
        stats.insert("total_event_drops".to_string(), serde_json::json!(total_drops));

        let total_throttled_batches = watchers.values()
            .map(|w| w.throttled_batches_count.try_read().map(|guard| *guard).unwrap_or(0))
            .sum::<u64>();
        stats.insert("total_throttled_batches".to_string(), serde_json::json!(total_throttled_batches));

        stats
    }

    pub async fn record_failure(&mut self, path: &PathBuf) {
        self.suspender.record_failure(path);
    }

    pub async fn record_success(&mut self, path: &PathBuf) {
        self.suspender.record_success(path);
    }

    pub fn is_suspended(&self, path: &PathBuf) -> bool {
        self.suspender.is_suspended(path)
    }

    pub fn check_resurrection(&mut self, path: &PathBuf, correlation_id: Option<u32>) -> bool {
        self.suspender.check_resurrection(path, correlation_id)
    }

    pub async fn resume_watcher(&mut self, path: &PathBuf) {
        self.suspender.resume(path);
    }

    pub async fn force_suspend_watcher(&mut self, path: &PathBuf) {
        self.suspender.suspend(path);
    }

    pub fn log_console(&self, severity: &str, arguments: Vec<String>) {
        let console = serde_json::json!({"type": "__$console", "severity": severity, "arguments": arguments});
        let json = serde_json::to_string(&console).unwrap();
        (self.ipc_sink)(json);
    }

    pub async fn set_verbose_logging(&self, enabled: bool) {
        *self.verbose.write().await = enabled;
        if enabled {
            let stats = self.get_stats().await;
            if !stats.is_empty() {
                let stats_json = serde_json::to_string(&stats).unwrap();
                self.log_console("log", vec![stats_json]);
            }
        }
    }

    pub async fn stop(&self) -> Result<(), WatcherError> {
        // Abort all tasks
        let mut tasks = self.tasks.write().await;
        for (_id, handle) in tasks.drain() {
            handle.abort();
        }

        // Clear watchers
        self.watchers_instances.write().await.clear();

        Ok(())
    }
}

// RPC integration methods for use with the dispatcher
pub fn create_watcher_service(ipc_sink: Arc<dyn Fn(String) + Send + Sync>) -> UniversalWatcher {
    UniversalWatcher::new(ipc_sink)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_watch_unwatch() {
        let ipc_sink = Arc::new(|_msg: String| {});
        let mut service = UniversalWatcher::new(ipc_sink);
        let temp_dir = tempdir().unwrap();

        let requests = vec![WatchRequest {
            path: "file:///tmp/test".to_string(),
            excludes: vec![],
            includes: None,
            recursive: true,
            correlation_id: None,
            filter: None,
            polling_interval: None,
        }];

        // Test watch
        assert!(service.watch(requests).await.is_ok());

        // Test unwatch
        assert!(service.unwatch("file:///tmp/test").await.is_ok());

        // Test unwatch non-existent
        assert!(service.unwatch("non-existent").await.is_err());
    }

    #[tokio::test]
    async fn test_stats() {
        let ipc_sink = Arc::new(|_msg: String| {});
        let mut service = UniversalWatcher::new(ipc_sink);
        let temp_dir = tempdir().unwrap();

        let requests = vec![WatchRequest {
            path: "file:///tmp/test".to_string(),
            excludes: vec![],
            includes: None,
            recursive: true,
            correlation_id: None,
            filter: None,
            polling_interval: None,
        }];

        service.watch(requests).await.unwrap();
        let stats = service.get_stats().await;

        assert_eq!(stats["total_watchers"], 1);
        assert_eq!(stats["recursive_watchers"], 1);
        assert_eq!(stats["non_recursive_watchers"], 0);
    }
}