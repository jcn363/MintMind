/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use crate::services::watcher::types::{FileChange, FileChangeType, normalize_path, pathbuf_to_file_uri};
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use crossbeam_channel::unbounded;
use std::path::PathBuf;
use std::sync::mpsc::{channel, Receiver};
use std::thread;
use std::sync::Arc;

#[derive(Clone, Debug)]
pub struct SubscriptionHandle {
    // Placeholder for subscription handle
}

pub struct RecursiveWatcher {
    _watcher: RecommendedWatcher,
    receiver: Receiver<Vec<FileChange>>,
    _handle: thread::JoinHandle<()>,
}

fn map_event_kind(kind: EventKind) -> FileChangeType {
    match kind {
        EventKind::Create(_) | EventKind::Any => FileChangeType::Added,
        EventKind::Remove(_) => FileChangeType::Deleted,
        EventKind::Modify(_) | EventKind::Access(_) | EventKind::Other => FileChangeType::Updated,
    }
}

fn coalesce_events(events: Vec<FileChange>) -> Vec<FileChange> {
    // Simplified coalescing - for now just return events as-is
    // In the future, this could merge duplicate events for the same path
    events
}

#[cfg(target_os = "windows")]
fn handle_windows_rename(event: &Event) -> Vec<FileChange> {
    use notify::event::RenameMode;

    if let EventKind::Modify(EventKind::Name(RenameMode::Both { from, to })) = &event.kind {
        let mtime = None; // For now, we'll set mtime to None as the field doesn't exist
        let mut changes = Vec::new();

        // Deleted event for old path
        if let Ok(resource_uri) = pathbuf_to_file_uri(normalize_path(from.clone())) {
            changes.push(FileChange {
                resource: resource_uri,
                change_type: FileChangeType::Deleted,
                correlation_id: None,
                mtime,
            });
        }

        // Added event for new path
        if let Ok(resource_uri) = pathbuf_to_file_uri(normalize_path(to.clone())) {
            changes.push(FileChange {
                resource: resource_uri,
                change_type: FileChangeType::Added,
                correlation_id: None,
                mtime,
            });
        }

        changes
    } else {
        Vec::new()
    }
}

#[cfg(not(target_os = "windows"))]
fn handle_windows_rename(_event: &Event) -> Vec<FileChange> {
    Vec::new()
}

impl RecursiveWatcher {
    pub fn new(path: PathBuf) -> Result<Self, notify::Error> {
        let normalized_path = normalize_path(path);
        let (tx, rx) = channel();

        // Create raw notify watcher
        let (raw_tx, raw_rx) = unbounded::<Event>();
        let mut watcher = RecommendedWatcher::new(move |res: notify::Result<Event>| {
            if let Ok(event) = res {
                let _ = raw_tx.send(event);
            }
        }, notify::Config::default())?;

        watcher.watch(&normalized_path, RecursiveMode::Recursive)?;

        // Create debouncer channel
        let (debounce_tx, debounce_rx) = unbounded::<Vec<FileChange>>();

        // Spawn event processing task
        let handle = thread::spawn(move || {
            // Create debouncer with 75ms delay matching TS version
            let mut pending_events = Vec::new();
            let mut last_process = std::time::Instant::now();

            loop {
                match raw_rx.recv_timeout(std::time::Duration::from_millis(75)) {
                    Ok(event) => {
                        // Handle Windows rename specially
                        let mut changes = handle_windows_rename(&event);

                        if changes.is_empty() {
                            // Regular event mapping
                            let change_type = map_event_kind(event.kind);
                            let mtime = None; // For now, we'll set mtime to None as the field doesn't exist

                            for path in &event.paths {
                                let normalized_event_path = normalize_path(path.clone());
                                if let Ok(resource_uri) = pathbuf_to_file_uri(normalized_event_path) {
                                    changes.push(FileChange {
                                        resource: resource_uri,
                                        change_type,
                                        correlation_id: None,
                                        mtime,
                                    });
                                }
                            }
                        }

                        pending_events.extend(changes);

                        // Process immediately if enough time has passed
                        let now = std::time::Instant::now();
                        if now.duration_since(last_process) >= std::time::Duration::from_millis(75) {
                            if !pending_events.is_empty() {
                                let _ = debounce_tx.send(pending_events.clone());
                                pending_events.clear();
                            }
                            last_process = now;
                        }
                    }
                    Err(_) => {
                        // Timeout - send any pending events
                        if !pending_events.is_empty() {
                            let _ = debounce_tx.send(pending_events.clone());
                            pending_events.clear();
                        }
                        last_process = std::time::Instant::now();
                    }
                }
            }
        });

        // Spawn debouncer task
        let _debounce_handle = thread::spawn(move || {
            loop {
                match debounce_rx.recv() {
                    Ok(events) => {
                        // Coalesce events
                        let coalesced = coalesce_events(events);
                        let _ = tx.send(coalesced);
                    }
                    Err(_) => break,
                }
            }
        });

        Ok(RecursiveWatcher {
            _watcher: watcher,
            receiver: rx,
            _handle: handle,
        })
    }

    pub fn recv(&self) -> Result<Vec<FileChange>, std::sync::mpsc::RecvError> {
        self.receiver.recv()
    }

    pub fn try_recv(&self) -> Result<Vec<FileChange>, std::sync::mpsc::TryRecvError> {
        self.receiver.try_recv()
    }

    pub fn path_exists(&self) -> bool {
        // For recursive watcher, check if the watched path exists
        // Note: We don't store the path, but in practice, the watcher fails if path doesn't exist
        // For now, assume it exists unless we add path tracking
        true
    }

    pub fn subscribe(&self, path: PathBuf, callback: Arc<dyn Fn(Option<FileChange>)>) -> Option<SubscriptionHandle> {
        // For resurrection monitoring, try to reuse the recursive watcher
        // This is a simplified implementation - in practice would need to integrate with the notify system
        let path_clone = path.clone();
        let _callback_clone = callback.clone();

        // Check if path exists immediately
        if path.exists() {
            let event = FileChange {
                resource: pathbuf_to_file_uri(path_clone).unwrap_or_else(|_| format!("file://{}", path.display())),
                change_type: FileChangeType::Added,
                correlation_id: None,
                mtime: Some(std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as i64),
            };
            callback(Some(event));
            return Some(SubscriptionHandle {});
        }

        // For now, return None to fall back to polling
        None
    }

}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[cfg_attr(miri, ignore)]
    #[test]
    fn test_recursive_watcher_creation() {
        let temp_dir = tempdir().unwrap();
        let watcher = RecursiveWatcher::new(temp_dir.path().to_path_buf());
        assert!(watcher.is_ok());
    }

    #[test]
    fn test_event_conversion() {
        use notify::event::{CreateKind, EventAttributes};
        use notify::EventKind;

        // Test Create event
        let create_event = Event {
            kind: EventKind::Create(CreateKind::File),
            paths: vec![PathBuf::from("/tmp/test.txt")],
            attrs: EventAttributes::default(),
        };
        assert_eq!(map_event_kind(create_event.kind), FileChangeType::Added);

        // Test Remove event
        let remove_event = Event {
            kind: EventKind::Remove(notify::event::RemoveKind::File),
            paths: vec![PathBuf::from("/tmp/test.txt")],
            attrs: EventAttributes::default(),
        };
        assert_eq!(map_event_kind(remove_event.kind), FileChangeType::Deleted);

        // Test Modify event
        let modify_event = Event {
            kind: EventKind::Modify(notify::event::ModifyKind::Data(notify::event::DataChange::Content)),
            paths: vec![PathBuf::from("/tmp/test.txt")],
            attrs: EventAttributes::default(),
        };
        assert_eq!(map_event_kind(modify_event.kind), FileChangeType::Updated);
    }
}