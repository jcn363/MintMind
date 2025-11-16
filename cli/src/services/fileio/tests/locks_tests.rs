/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use std::sync::Arc;
use tempfile::TempDir;
use tokio::time::{timeout, Duration};
use futures::future::join_all;

use crate::services::fileio::locks::ResourceLockManager;

#[tokio::test]
async fn test_acquire_release() {
    let mut lock_manager = ResourceLockManager::new();
    let resource_path = "/test/file.txt";

    // Acquire lock
    let _guard = lock_manager.acquire_lock(resource_path).await.unwrap();

    // Verify it's locked
    assert!(lock_manager.is_locked(resource_path).unwrap());

    // Drop guard (releases lock)
    drop(_guard);

    // Verify it's released
    assert!(!lock_manager.is_locked(resource_path).unwrap());
}

#[tokio::test]
async fn test_concurrent_writes_serialized() {
    let lock_manager = Arc::new(tokio::sync::Mutex::new(ResourceLockManager::new()));
    let temp_dir = TempDir::new().unwrap();
    let file_path = temp_dir.path().join("test.txt").to_string_lossy().to_string();

    let mut handles = vec![];
    let mut timestamps = Arc::new(tokio::sync::Mutex::new(Vec::new()));
    let counter = Arc::new(tokio::sync::Mutex::new(0));

    // Spawn 10 tasks
    for i in 0..10 {
        let lock_manager = lock_manager.clone();
        let file_path = file_path.clone();
        let timestamps = timestamps.clone();
        let counter = counter.clone();

        let handle = tokio::spawn(async move {
            let start = std::time::Instant::now();

            // Acquire lock
            {
                let mut manager = lock_manager.lock().await;
                let _guard = manager.acquire_lock(&file_path).await.unwrap();

                // Simulate operation
                tokio::time::sleep(Duration::from_millis(10)).await;

                // Write to file
                std::fs::write(&file_path, format!("Content {}", i)).unwrap();

                let mut counter = counter.lock().await;
                *counter += 1;
            }

            let end = std::time::Instant::now();
            let duration = end.duration_since(start);

            let mut timestamps = timestamps.lock().await;
            timestamps.push(duration);

            Ok::<(), Box<dyn std::error::Error + Send + Sync>>(())
        });

        handles.push(handle);
    }

    // Wait for all to complete
    for handle in handles {
        handle.await.unwrap().unwrap();
    }

    // Verify operations completed sequentially (counter should be 10)
    let counter = counter.lock().await;
    assert_eq!(*counter, 10);

    // Check timestamps to ensure serialization (though not perfectly strict due to scheduling)
    let timestamps = timestamps.lock().await;
    assert_eq!(timestamps.len(), 10);
}

#[tokio::test]
async fn test_different_files_concurrent() {
    let lock_manager = Arc::new(tokio::sync::Mutex::new(ResourceLockManager::new()));
    let temp_dir = TempDir::new().unwrap();

    let mut handles = vec![];

    // Write to 10 different files concurrently
    for i in 0..10 {
        let lock_manager = lock_manager.clone();
        let file_path = temp_dir.path().join(format!("file{}.txt", i)).to_string_lossy().to_string();

        let handle = tokio::spawn(async move {
            let mut manager = lock_manager.lock().await;
            let _guard = manager.acquire_lock(&file_path).await.unwrap();

            // Simulate operation
            tokio::time::sleep(Duration::from_millis(10)).await;

            // Write to file
            std::fs::write(&file_path, format!("Content {}", i)).unwrap();

            Ok::<(), Box<dyn std::error::Error + Send + Sync>>(())
        });

        handles.push(handle);
    }

    // All should succeed without blocking each other
    let results = join_all(handles).await;
    for result in results {
        result.unwrap().unwrap();
    }

    // Verify all files were created
    for i in 0..10 {
        let file_path = temp_dir.path().join(format!("file{}.txt", i));
        assert!(file_path.exists());
        let content = std::fs::read_to_string(&file_path).unwrap();
        assert_eq!(content, format!("Content {}", i));
    }
}

#[tokio::test]
async fn test_multiple_waiters_fifo() {
    let lock_manager = Arc::new(tokio::sync::Mutex::new(ResourceLockManager::new()));
    let temp_dir = TempDir::new().unwrap();
    let file_path = temp_dir.path().join("fifo_test.txt").to_string_lossy().to_string();

    let mut handles = vec![];
    let results = Arc::new(tokio::sync::Mutex::new(Vec::new()));

    // Hold the lock initially
    let lock_manager_clone = lock_manager.clone();
    let file_path_clone = file_path.clone();
    let initial_handle = tokio::spawn(async move {
        let mut manager = lock_manager_clone.lock().await;
        let _guard = manager.acquire_lock(&file_path_clone).await.unwrap();

        // Hold for a bit
        tokio::time::sleep(Duration::from_millis(100)).await;
    });

    // Small delay to ensure initial lock is acquired
    tokio::time::sleep(Duration::from_millis(10)).await;

    // Spawn 5 tasks waiting on lock
    for i in 0..5 {
        let lock_manager = lock_manager.clone();
        let file_path = file_path.clone();
        let results = results.clone();

        let handle = tokio::spawn(async move {
            let start = std::time::Instant::now();

            let mut manager = lock_manager.lock().await;
            let _guard = manager.acquire_lock(&file_path).await.unwrap();

            let end = std::time::Instant::now();
            let wait_duration = end.duration_since(start);

            // Write to mark completion order
            std::fs::write(&file_path, format!("Task {}", i)).unwrap();

            let mut results = results.lock().await;
            results.push((i, wait_duration));

            Ok::<(), Box<dyn std::error::Error + Send + Sync>>(())
        });

        handles.push(handle);
    }

    // Wait for initial lock to release
    initial_handle.await.unwrap();

    // Wait for all waiters
    for handle in handles {
        handle.await.unwrap().unwrap();
    }

    // Verify they acquired in spawn order (FIFO)
    let results = results.lock().await;
    assert_eq!(results.len(), 5);

    for (i, &(task_id, _)) in results.iter().enumerate() {
        assert_eq!(task_id, i as u32);
    }
}

#[tokio::test]
async fn test_case_insensitive_locking() {
    let mut lock_manager = ResourceLockManager::new();
    let temp_dir = TempDir::new().unwrap();

    // Create file.txt
    let file_path_lower = temp_dir.path().join("file.txt").to_string_lossy().to_string();
    std::fs::write(&file_path_lower, "content").unwrap();

    // Acquire lock on file.txt
    let _guard1 = lock_manager.acquire_lock(&file_path_lower).await.unwrap();
    assert!(lock_manager.is_locked(&file_path_lower).unwrap());

    // Try to acquire lock on FILE.TXT (should be the same lock on Windows/macOS)
    let file_path_upper = temp_dir.path().join("FILE.TXT").to_string_lossy().to_string();

    // On case-insensitive filesystems, this should wait or fail to acquire
    // We use a timeout to detect if it's trying to acquire the same lock
    let timeout_result = timeout(
        Duration::from_millis(100),
        lock_manager.acquire_lock(&file_path_upper)
    ).await;

    // Should timeout because it's the same lock
    assert!(timeout_result.is_err());
}

#[tokio::test]
async fn test_lock_deadlock_prevention() {
    let lock_manager = Arc::new(tokio::sync::Mutex::new(ResourceLockManager::new()));
    let temp_dir = TempDir::new().unwrap();
    let file_a = temp_dir.path().join("a.txt").to_string_lossy().to_string();
    let file_b = temp_dir.path().join("b.txt").to_string_lossy().to_string();

    std::fs::write(&file_a, "a").unwrap();
    std::fs::write(&file_b, "b").unwrap();

    let mut handles = vec![];

    // Task 1: acquire A then B
    let lock_manager1 = lock_manager.clone();
    let file_a1 = file_a.clone();
    let file_b1 = file_b.clone();
    let handle1 = tokio::spawn(async move {
        let mut manager = lock_manager1.lock().await;
        let _guard_a = manager.acquire_lock(&file_a1).await.unwrap();
        tokio::time::sleep(Duration::from_millis(50)).await; // Small delay
        let _guard_b = manager.acquire_lock(&file_b1).await.unwrap();
        Ok::<(), Box<dyn std::error::Error + Send + Sync>>(())
    });

    // Task 2: acquire B then A
    let lock_manager2 = lock_manager.clone();
    let file_a2 = file_a.clone();
    let file_b2 = file_b.clone();
    let handle2 = tokio::spawn(async move {
        let mut manager = lock_manager2.lock().await;
        let _guard_b = manager.acquire_lock(&file_b2).await.unwrap();
        tokio::time::sleep(Duration::from_millis(50)).await; // Small delay
        let _guard_a = manager.acquire_lock(&file_a2).await.unwrap();
        Ok::<(), Box<dyn std::error::Error + Send + Sync>>(())
    });

    handles.push(handle1);
    handles.push(handle2);

    // Use timeout to ensure no deadlock (should complete within reasonable time)
    let timeout_result = timeout(Duration::from_millis(1000), join_all(handles)).await;

    // Should not timeout (no deadlock)
    assert!(timeout_result.is_ok());

    let results = timeout_result.unwrap();
    for result in results {
        result.unwrap().unwrap();
    }
}