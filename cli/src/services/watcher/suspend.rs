/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Instant;
use tokio::task::JoinHandle;
use tokio::time::Interval;
use crate::services::watcher::types::{FileChange, FileChangeType};

#[derive(Debug)]
pub enum MonitoringMethod {
    Subscription(crate::services::watcher::recursive::SubscriptionHandle),
    Polling(Interval),
}

#[derive(Debug)]
pub struct SuspendedInfo {
    pub monitoring: MonitoringMethod,
    pub task: Option<JoinHandle<()>>,
    pub start_time: Instant,
}

pub struct WatcherSuspender {
    suspended: HashMap<PathBuf, SuspendedInfo>,
    event_callback: Arc<dyn Fn(FileChange) + Send + Sync>,
    correlation_map: HashMap<PathBuf, Option<u32>>,
    failures: HashMap<PathBuf, u32>,
}

impl WatcherSuspender {
    pub fn new(event_callback: Arc<dyn Fn(FileChange) + Send + Sync>) -> Self {
        WatcherSuspender {
            suspended: HashMap::new(),
            event_callback,
            correlation_map: HashMap::new(),
            failures: HashMap::new(),
        }
    }

    /// Record a failure for a watcher path
    pub fn record_failure(&mut self, path: &PathBuf) {
        let count = self.failures.entry(path.clone()).or_insert(0);
        *count += 1;
        if *count >= 5 {
            self.suspend(path);
        }
    }

    /// Record success for a watcher path (resets failure count)
    pub fn record_success(&mut self, path: &PathBuf) {
        self.failures.remove(path);
    }

    /// Check if a watcher path is currently suspended
    pub fn is_suspended(&self, path: &PathBuf) -> bool {
        self.suspended.contains_key(path)
    }

    /// Get all suspended paths
    pub fn suspended_paths(&self) -> Vec<PathBuf> {
        self.suspended.keys().cloned().collect()
    }

    /// Force resume a suspended watcher
    pub fn resume(&mut self, path: &PathBuf) {
        if let Some(suspended_info) = self.suspended.remove(path) {
            match suspended_info.monitoring {
                MonitoringMethod::Subscription(handle) => {
                    // Unsubscribe
                    drop(handle);
                }
                MonitoringMethod::Polling(_interval) => {
                    // Abort the task
                    if let Some(task) = suspended_info.task {
                        task.abort();
                    }
                }
            }
        }
        self.failures.remove(path);
    }

    /// Force suspend a watcher
    pub fn suspend(&mut self, path: &PathBuf) {
        if self.suspended.contains_key(path) {
            return; // Already suspended
        }

        // For now, we'll implement polling as specified
        // Note: In real implementation, would try to reuse recursive watcher first

        let suspended_info = SuspendedInfo {
            monitoring: MonitoringMethod::Polling(tokio::time::interval_at(tokio::time::Instant::now(), std::time::Duration::from_millis(5007))),
            task: None, // Task will be started when suspending
            start_time: Instant::now(),
        };

        self.suspended.insert(path.clone(), suspended_info);
        log::info!("suspending watcher for {} (cId: {:?})", path.display(), self.correlation_map.get(path).cloned().flatten());
    }

    /// Check if a path has been resurrected and emit Added event if so
    pub fn check_resurrection(&mut self, path: &PathBuf, c_id: Option<u32>) -> bool {
        if !self.suspended.contains_key(path) {
            return false;
        }

        if path.exists() {
            let correlation_id = self.correlation_map.get(path).cloned().flatten().or(c_id);
            let event = FileChange {
                resource: crate::services::watcher::types::pathbuf_to_file_uri(path.clone()).unwrap_or_else(|_| format!("file://{}", path.display())),
                change_type: FileChangeType::Added,
                correlation_id,
                mtime: Some(std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as i64),
            };
            (self.event_callback)(event);
            self.resume(path);
            log::info!("detected {} exists again, resuming (cId: {:?})", path.display(), correlation_id);
            return true;
        }

        false
    }


    /// Set correlation ID for a suspended path
    pub fn set_correlation_id(&mut self, path: &PathBuf, correlation_id: Option<u32>) {
        self.correlation_map.insert(path.clone(), correlation_id);
    }
}

impl Default for WatcherSuspender {
    fn default() -> Self {
        WatcherSuspender {
            suspended: HashMap::new(),
            event_callback: Arc::new(|_| {}),
            correlation_map: HashMap::new(),
            failures: HashMap::new(),
        }
    }
}

impl Clone for WatcherSuspender {
    fn clone(&self) -> Self {
        WatcherSuspender {
            suspended: HashMap::new(), // Don't clone suspended state
            event_callback: self.event_callback.clone(),
            correlation_map: HashMap::new(), // Don't clone correlation state
            failures: HashMap::new(), // Don't clone failure state
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use tempfile::tempdir;
    use tokio::runtime::Runtime;
    use std::sync::Mutex;

    fn create_test_suspender() -> WatcherSuspender {
        let callback = Arc::new(|_: FileChange| {});
        WatcherSuspender::new(callback)
    }


    #[cfg_attr(miri, ignore)]
    #[test]
    fn test_basic_suspend_resume() {
        let mut suspender = create_test_suspender();
        let path = PathBuf::from("/test/path");

        // Initially not suspended
        assert!(!suspender.is_suspended(&path));

        // Suspend
        suspender.suspend(&path);
        assert!(suspender.is_suspended(&path));

        // Resume
        suspender.resume(&path);
        assert!(!suspender.is_suspended(&path));
    }

    #[cfg_attr(miri, ignore)]
    #[test]
    fn test_record_failure_and_suspend() {
        let mut suspender = create_test_suspender();
        let path = PathBuf::from("/test/path");

        // Record 4 failures - should not suspend yet
        for _ in 0..4 {
            suspender.record_failure(&path);
        }
        assert!(!suspender.is_suspended(&path));

        // 5th failure should suspend
        suspender.record_failure(&path);
        assert!(suspender.is_suspended(&path));
    }

    #[cfg_attr(miri, ignore)]
    #[test]
    fn test_record_success_resets_failures() {
        let mut suspender = create_test_suspender();
        let path = PathBuf::from("/test/path");

        // Record 4 failures
        for _ in 0..4 {
            suspender.record_failure(&path);
        }

        // Record success - should reset
        suspender.record_success(&path);
        assert!(!suspender.is_suspended(&path));

        // Should need 5 more failures to suspend
        for _ in 0..4 {
            suspender.record_failure(&path);
        }
        assert!(!suspender.is_suspended(&path));

        suspender.record_failure(&path);
        assert!(suspender.is_suspended(&path));
    }

    #[cfg_attr(miri, ignore)]
    #[test]
    fn test_check_resurrection() {
        let temp_dir = tempdir().unwrap();
        let test_file = temp_dir.path().join("test.txt");

        let callback_called = Arc::new(Mutex::new(false));
        let callback_called_clone = callback_called.clone();
        let callback = Arc::new(move |_: FileChange| {
            *callback_called_clone.lock().unwrap() = true;
        });

        let mut suspender = WatcherSuspender::new(callback);

        // Suspend the path (doesn't exist yet)
        suspender.set_correlation_id(&test_file, Some(42));
        suspender.suspend(&test_file);
        assert!(suspender.is_suspended(&test_file));

        // Check resurrection on non-existent file (should not resurrect)
        let resurrected = suspender.check_resurrection(&test_file, None);
        assert!(!resurrected);
        assert!(suspender.is_suspended(&test_file));
        assert!(!*callback_called.lock().unwrap());

        // Create the file
        std::fs::write(&test_file, "test").unwrap();

        // Check resurrection again
        let resurrected = suspender.check_resurrection(&test_file, None);
        assert!(resurrected);
        assert!(!suspender.is_suspended(&test_file));
        assert!(*callback_called.lock().unwrap());
    }


    #[cfg_attr(miri, ignore)]
    #[test]
    fn test_suspend_resume() {
        let mut suspender = create_test_suspender();
        let path = PathBuf::from("/test/path");

        // Suspend
        suspender.suspend(&path);
        assert!(suspender.is_suspended(&path));

        // Resume
        suspender.resume(&path);
        assert!(!suspender.is_suspended(&path));
    }
}