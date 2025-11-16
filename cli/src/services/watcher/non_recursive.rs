/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use crate::services::watcher::types::{FileChange, FileChangeType, normalize_path, pathbuf_to_file_uri};
use notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_mini::{DebounceEventResult, Debouncer};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::time::SystemTime;

pub struct NonRecursiveWatcher {
    watchers: Arc<Mutex<HashMap<PathBuf, Debouncer<RecommendedWatcher>>>>,
    receiver: Receiver<DebounceEventResult>,
    base_path: PathBuf,
    tx: Sender<DebounceEventResult>,
}

impl NonRecursiveWatcher {
    pub fn new(base_path: PathBuf) -> Result<Self, notify::Error> {
        let normalized_base_path = normalize_path(base_path);
        let (tx, rx) = channel();

        Ok(NonRecursiveWatcher {
            watchers: Arc::new(Mutex::new(HashMap::new())),
            receiver: rx,
            base_path: normalized_base_path,
            tx,
        })
    }

    /// Add a directory to watch (non-recursively)
    pub fn watch_directory(&self, path: PathBuf) -> Result<(), notify::Error> {
        let normalized_path = normalize_path(path);
        let mut watchers = self.watchers.lock().unwrap();

        if watchers.contains_key(&normalized_path) {
            return Ok(()); // Already watching
        }

        let tx_clone = self.tx.clone();

        let mut debouncer = notify_debouncer_mini::new_debouncer(
            std::time::Duration::from_millis(50),
            move |result: DebounceEventResult| {
                let _ = tx_clone.send(result);
            }
        )?;

        debouncer.watcher().watch(&normalized_path, RecursiveMode::NonRecursive)?;
        watchers.insert(normalized_path, debouncer);

        Ok(())
    }

    /// Remove a directory from watching
    pub fn unwatch_directory(&self, path: &Path) -> Result<(), notify::Error> {
        let mut watchers = self.watchers.lock().unwrap();
        watchers.remove(path);
        Ok(())
    }

    /// Get all currently watched directories
    pub fn watched_directories(&self) -> Vec<PathBuf> {
        let watchers = self.watchers.lock().unwrap();
        watchers.keys().cloned().collect()
    }

    pub fn recv(&self) -> Result<Vec<FileChange>, std::sync::mpsc::RecvError> {
        self.receiver.recv().map(|event_result| match event_result {
            DebounceEventResult::Ok(events) => events
                .into_iter()
                .filter_map(|event| self.convert_event(&event))
                .collect(),
            DebounceEventResult::Err(_) => Vec::new(),
        })
    }

    pub fn try_recv(&self) -> Result<Vec<FileChange>, std::sync::mpsc::TryRecvError> {
        self.receiver.try_recv().map(|event_result| match event_result {
            DebounceEventResult::Ok(events) => events
                .into_iter()
                .filter_map(|event| self.convert_event(&event))
                .collect(),
            DebounceEventResult::Err(_) => Vec::new(),
        })
    }

    pub fn path_exists(&self) -> bool {
        // For non-recursive watcher, check if the base path exists
        self.base_path.exists()
    }

    fn convert_event(&self, event: &notify_debouncer_mini::DebouncedEvent) -> Option<FileChange> {
        // For debounced events, we don't have detailed event type information
        // since they combine multiple events. We'll use a default change type.
        // In a more sophisticated implementation, you might want to track
        // the actual event types that were debounced.
        let change_type = FileChangeType::Updated;

        let mtime = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .ok()
            .map(|d| d.as_millis() as i64);

        // Only include events that are direct children of watched directories
        let event_path = event.path.clone();
        let normalized_event_path = normalize_path(event_path);
        if let Some(parent) = normalized_event_path.parent() {
            let watchers = self.watchers.lock().unwrap();
            if watchers.contains_key(parent) {
                let resource_uri = match pathbuf_to_file_uri(normalized_event_path) {
                    Ok(uri) => uri,
                    Err(_) => return None,
                };
                return Some(FileChange {
                    resource: resource_uri,
                    change_type,
                    correlation_id: None,
                    mtime,
                });
            }
        }

        None
    }

    /// Check if a path is currently being watched (either directly or as a child of a watched directory)
    pub fn is_watching(&self, path: &Path) -> bool {
        let normalized_path = normalize_path(path.to_path_buf());
        let watchers = self.watchers.lock().unwrap();

        // Check if this exact path is watched
        if watchers.contains_key(&normalized_path) {
            return true;
        }

        // Check if any parent directory is watched
        for watched_path in watchers.keys() {
            if normalized_path.starts_with(watched_path) {
                return true;
            }
        }

        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_non_recursive_watcher_creation() {
        let temp_dir = tempdir().unwrap();
        let watcher = NonRecursiveWatcher::new(temp_dir.path().to_path_buf());
        assert!(watcher.is_ok());
    }

    #[test]
    fn test_watch_unwatch_directory() {
        let temp_dir = tempdir().unwrap();
        let sub_dir = temp_dir.path().join("subdir");
        std::fs::create_dir(&sub_dir).unwrap();

        let watcher = NonRecursiveWatcher::new(temp_dir.path().to_path_buf()).unwrap();

        // Watch subdirectory
        assert!(watcher.watch_directory(sub_dir.clone()).is_ok());
        assert!(watcher.is_watching(&sub_dir));

        // Unwatch
        assert!(watcher.unwatch_directory(&sub_dir).is_ok());
        assert!(!watcher.is_watching(&sub_dir));
    }
}