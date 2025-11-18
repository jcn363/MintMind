/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use crate::services::watcher::service::UniversalWatcher;
use crate::services::watcher::types::{FileChangeType, WatchRequest};
use std::fs;
use std::path::PathBuf;
use tempfile::tempdir;
use tokio::time::{sleep, Duration};

#[cfg_attr(miri, ignore)]
#[tokio::test]
async fn test_full_watcher_lifecycle() {
    let service = UniversalWatcher::new();
    let temp_dir = tempdir().unwrap();
    let test_file = temp_dir.path().join("test.txt");

    // Create watch request
    let request = WatchRequest {
        id: "integration-test".to_string(),
        path: temp_dir.path().to_path_buf(),
        excludes: vec![],
        includes: vec![],
        recursive: true,
        polling_interval: None,
    };

    // Start watching
    assert!(service.watch(request).await.is_ok());

    // Create a file
    fs::write(&test_file, "test content").unwrap();

    // Wait a bit for events to be processed
    sleep(Duration::from_millis(100)).await;

    // Process events
    assert!(service.process_events().await.is_ok());

    // Check for pending changes
    let changes = service.get_pending_changes("integration-test").await.unwrap();
    assert!(changes.is_some());

    let changes = changes.unwrap();
    assert!(!changes.changes.is_empty());

    // Find the added file event
    let added_event = changes.changes.iter().find(|c| {
        c.path == test_file && c.change_type == FileChangeType::Added
    });
    assert!(added_event.is_some());

    // Modify the file
    fs::write(&test_file, "modified content").unwrap();

    // Wait and process again
    sleep(Duration::from_millis(100)).await;
    assert!(service.process_events().await.is_ok());

    let changes = service.get_pending_changes("integration-test").await.unwrap();
    assert!(changes.is_some());

    let changes = changes.unwrap();
    let changed_event = changes.changes.iter().find(|c| {
        c.path == test_file && c.change_type == FileChangeType::Changed
    });
    assert!(changed_event.is_some());

    // Delete the file
    fs::remove_file(&test_file).unwrap();

    // Wait and process again
    sleep(Duration::from_millis(100)).await;
    assert!(service.process_events().await.is_ok());

    let changes = service.get_pending_changes("integration-test").await.unwrap();
    assert!(changes.is_some());

    let changes = changes.unwrap();
    let removed_event = changes.changes.iter().find(|c| {
        c.path == test_file && c.change_type == FileChangeType::Removed
    });
    assert!(removed_event.is_some());

    // Stop watching
    assert!(service.unwatch("integration-test").await.is_ok());
}

#[cfg_attr(miri, ignore)]
#[tokio::test]
async fn test_multiple_watchers() {
    let service = UniversalWatcher::new();

    let temp_dir1 = tempdir().unwrap();
    let temp_dir2 = tempdir().unwrap();

    let request1 = WatchRequest {
        id: "watcher1".to_string(),
        path: temp_dir1.path().to_path_buf(),
        excludes: vec![],
        includes: vec![],
        recursive: true,
        polling_interval: None,
    };

    let request2 = WatchRequest {
        id: "watcher2".to_string(),
        path: temp_dir2.path().to_path_buf(),
        excludes: vec![],
        includes: vec![],
        recursive: true,
        polling_interval: None,
    };

    // Start both watchers
    assert!(service.watch(request1).await.is_ok());
    assert!(service.watch(request2).await.is_ok());

    // Check stats
    let stats = service.get_stats().await;
    assert_eq!(stats["total_watchers"], 2);
    assert_eq!(stats["recursive_watchers"], 2);

    // Create files in both directories
    let file1 = temp_dir1.path().join("file1.txt");
    let file2 = temp_dir2.path().join("file2.txt");

    fs::write(&file1, "content1").unwrap();
    fs::write(&file2, "content2").unwrap();

    // Wait and process
    sleep(Duration::from_millis(100)).await;
    assert!(service.process_events().await.is_ok());

    // Check that both watchers detected changes
    let changes1 = service.get_pending_changes("watcher1").await.unwrap();
    let changes2 = service.get_pending_changes("watcher2").await.unwrap();

    assert!(changes1.is_some());
    assert!(changes2.is_some());

    // Stop both watchers
    assert!(service.unwatch("watcher1").await.is_ok());
    assert!(service.unwatch("watcher2").await.is_ok());

    let stats = service.get_stats().await;
    assert_eq!(stats["total_watchers"], 0);
}

#[cfg_attr(miri, ignore)]
#[tokio::test]
async fn test_excluded_files() {
    let service = UniversalWatcher::new();
    let temp_dir = tempdir().unwrap();

    let request = WatchRequest {
        id: "exclude-test".to_string(),
        path: temp_dir.path().to_path_buf(),
        excludes: vec!["*.tmp".to_string()],
        includes: vec![],
        recursive: true,
        polling_interval: None,
    };

    assert!(service.watch(request).await.is_ok());

    // Create included and excluded files
    let included_file = temp_dir.path().join("test.txt");
    let excluded_file = temp_dir.path().join("temp.tmp");

    fs::write(&included_file, "included").unwrap();
    fs::write(&excluded_file, "excluded").unwrap();

    // Wait and process
    sleep(Duration::from_millis(100)).await;
    assert!(service.process_events().await.is_ok());

    let changes = service.get_pending_changes("exclude-test").await.unwrap();
    assert!(changes.is_some());

    let changes = changes.unwrap();
    // Should only have the included file
    assert_eq!(changes.changes.len(), 1);
    assert_eq!(changes.changes[0].path, included_file);

    service.unwatch("exclude-test").await.unwrap();
}

#[cfg_attr(miri, ignore)]
#[tokio::test]
async fn test_non_recursive_watching() {
    let service = UniversalWatcher::new();
    let temp_dir = tempdir().unwrap();
    let sub_dir = temp_dir.path().join("subdir");
    fs::create_dir(&sub_dir).unwrap();

    let request = WatchRequest {
        id: "non-recursive-test".to_string(),
        path: temp_dir.path().to_path_buf(),
        excludes: vec![],
        includes: vec![],
        recursive: false,
        polling_interval: None,
    };

    assert!(service.watch(request).await.is_ok());

    // Create files in root and subdirectory
    let root_file = temp_dir.path().join("root.txt");
    let sub_file = sub_dir.join("sub.txt");

    fs::write(&root_file, "root").unwrap();
    fs::write(&sub_file, "sub").unwrap();

    // Wait and process
    sleep(Duration::from_millis(100)).await;
    assert!(service.process_events().await.is_ok());

    let changes = service.get_pending_changes("non-recursive-test").await.unwrap();
    assert!(changes.is_some());

    let changes = changes.unwrap();
    // Should only see the root file (non-recursive)
    assert_eq!(changes.changes.len(), 1);
    assert_eq!(changes.changes[0].path, root_file);

    service.unwatch("non-recursive-test").await.unwrap();
}

#[cfg_attr(miri, ignore)]
#[tokio::test]
async fn test_watcher_error_handling() {
    let service = UniversalWatcher::new();

    // Try to watch non-existent directory
    let request = WatchRequest {
        id: "error-test".to_string(),
        path: PathBuf::from("/non/existent/path"),
        excludes: vec![],
        includes: vec![],
        recursive: true,
        polling_interval: None,
    };

    // This might succeed or fail depending on implementation
    // but unwatch should handle non-existent watchers gracefully
    let _ = service.watch(request).await;
    assert!(service.unwatch("error-test").await.is_ok());
}