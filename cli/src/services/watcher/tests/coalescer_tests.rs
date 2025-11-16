/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use crate::services::watcher::coalescer::EventCoalescer;
use crate::services::watcher::types::{FileChange, FileChangeType};
use std::path::PathBuf;

#[test]
fn test_coalesce_empty_events() {
    let coalescer = EventCoalescer::new(vec![], vec![]).unwrap();
    let result = coalescer.coalesce_events(vec![]);
    assert!(result.is_empty());
}

#[test]
fn test_coalesce_single_event() {
    let coalescer = EventCoalescer::new(vec![], vec![]).unwrap();
    let event = FileChange {
        resource: "/test/file.txt".to_string(),
        change_type: FileChangeType::Updated,
        correlation_id: None,
        mtime: Some(1000),
    };

    let result = coalescer.coalesce_events(vec![event.clone()]);
    assert_eq!(result.len(), 1);
    assert_eq!(result[0], event);
}

#[test]
fn test_coalesce_create_then_delete() {
    let coalescer = EventCoalescer::new(vec![], vec![]).unwrap();

    let create_event = FileChange {
        resource: "/test/file.txt".to_string(),
        change_type: FileChangeType::Added,
        correlation_id: None,
        mtime: Some(1000),
    };

    let delete_event = FileChange {
        resource: "/test/file.txt".to_string(),
        change_type: FileChangeType::Deleted,
        correlation_id: None,
        mtime: Some(2000),
    };

    let result = coalescer.coalesce_events(vec![create_event, delete_event]);
    assert_eq!(result.len(), 1);
    assert_eq!(result[0].change_type, FileChangeType::Removed);
    assert_eq!(result[0].mtime, Some(2000));
}

#[test]
fn test_coalesce_delete_then_create() {
    let coalescer = EventCoalescer::new(vec![], vec![]).unwrap();

    let delete_event = FileChange {
        resource: "/test/file.txt".to_string(),
        change_type: FileChangeType::Deleted,
        correlation_id: None,
        mtime: Some(1000),
    };

    let create_event = FileChange {
        resource: "/test/file.txt".to_string(),
        change_type: FileChangeType::Added,
        correlation_id: None,
        mtime: Some(2000),
    };

    let result = coalescer.coalesce_events(vec![delete_event, create_event]);
    assert_eq!(result.len(), 1);
    assert_eq!(result[0].change_type, FileChangeType::Changed);
    assert_eq!(result[0].mtime, Some(2000));
}

#[test]
fn test_coalesce_multiple_changes_to_same_file() {
    let coalescer = EventCoalescer::new(vec![], vec![]).unwrap();

    let events = vec![
        FileChange {
            resource: "/test/file.txt".to_string(),
            change_type: FileChangeType::Added,
            correlation_id: None,
            mtime: Some(1000),
        },
        FileChange {
            resource: "/test/file.txt".to_string(),
            change_type: FileChangeType::Updated,
            correlation_id: None,
            mtime: Some(2000),
        },
        FileChange {
            resource: "/test/file.txt".to_string(),
            change_type: FileChangeType::Updated,
            correlation_id: None,
            mtime: Some(3000),
        },
    ];

    let result = coalescer.coalesce_events(events);
    assert_eq!(result.len(), 1);
    assert_eq!(result[0].change_type, FileChangeType::Updated);
    assert_eq!(result[0].mtime, Some(3000));
}

#[test]
fn test_coalesce_different_files() {
    let coalescer = EventCoalescer::new(vec![], vec![]).unwrap();

    let events = vec![
        FileChange {
            resource: "/test/file1.txt".to_string(),
            change_type: FileChangeType::Added,
            correlation_id: None,
            mtime: Some(1000),
        },
        FileChange {
            resource: "/test/file2.txt".to_string(),
            change_type: FileChangeType::Updated,
            correlation_id: None,
            mtime: Some(2000),
        },
        FileChange {
            resource: "/test/file3.txt".to_string(),
            change_type: FileChangeType::Deleted,
            correlation_id: None,
            mtime: Some(3000),
        },
    ];

    let result = coalescer.coalesce_events(events.clone());
    assert_eq!(result.len(), 3);
    assert_eq!(result[0].change_type, FileChangeType::Added);
    assert_eq!(result[1].change_type, FileChangeType::Updated);
    assert_eq!(result[2].change_type, FileChangeType::Deleted);
}

#[test]
fn test_coalesce_with_excludes() {
    let coalescer = EventCoalescer::new(vec!["*.tmp".to_string()], vec![]).unwrap();

    let events = vec![
        FileChange {
            resource: "/test/file.txt".to_string(),
            change_type: FileChangeType::Updated,
            correlation_id: None,
            mtime: Some(1000),
        },
        FileChange {
            resource: "/test/temp.tmp".to_string(),
            change_type: FileChangeType::Updated,
            correlation_id: None,
            mtime: Some(2000),
        },
    ];

    let result = coalescer.coalesce_events(events);
    assert_eq!(result.len(), 1);
    assert_eq!(result[0].resource, "/test/file.txt".to_string());
}

#[test]
fn test_coalesce_with_includes() {
    let coalescer = EventCoalescer::new(vec![], vec!["*.txt".to_string()]).unwrap();

    let events = vec![
        FileChange {
            resource: "/test/file.txt".to_string(),
            change_type: FileChangeType::Updated,
            correlation_id: None,
            mtime: Some(1000),
        },
        FileChange {
            resource: "/test/file.rs".to_string(),
            change_type: FileChangeType::Updated,
            correlation_id: None,
            mtime: Some(2000),
        },
    ];

    let result = coalescer.coalesce_events(events);
    assert_eq!(result.len(), 1);
    assert_eq!(result[0].resource, "/test/file.txt".to_string());
}

#[test]
fn test_coalesce_change_after_delete() {
    let coalescer = EventCoalescer::new(vec![], vec![]).unwrap();

    let delete_event = FileChange {
        resource: "/test/file.txt".to_string(),
        change_type: FileChangeType::Deleted,
        correlation_id: None,
        mtime: Some(1000),
    };

    let change_event = FileChange {
        resource: "/test/file.txt".to_string(),
        change_type: FileChangeType::Updated,
        correlation_id: None,
        mtime: Some(2000),
    };

    let result = coalescer.coalesce_events(vec![delete_event, change_event]);
    assert_eq!(result.len(), 1);
    assert_eq!(result[0].change_type, FileChangeType::Updated);
    assert_eq!(result[0].mtime, Some(2000));
}

#[test]
fn test_coalesce_multiple_deletes() {
    let coalescer = EventCoalescer::new(vec![], vec![]).unwrap();

    let events = vec![
        FileChange {
            resource: "/test/file.txt".to_string(),
            change_type: FileChangeType::Deleted,
            correlation_id: None,
            mtime: Some(1000),
        },
        FileChange {
            resource: "/test/file.txt".to_string(),
            change_type: FileChangeType::Deleted,
            correlation_id: None,
            mtime: Some(2000),
        },
    ];

    let result = coalescer.coalesce_events(events);
    assert_eq!(result.len(), 1);
    assert_eq!(result[0].change_type, FileChangeType::Deleted);
    assert_eq!(result[0].mtime, Some(2000));
}

#[test]
fn test_coalesce_ignore_create_followed_by_delete() {
    let coalescer = EventCoalescer::new(vec![], vec![]).unwrap();

    let create_event = FileChange {
        resource: "/test/file.txt".to_string(),
        change_type: FileChangeType::Added,
        correlation_id: None,
        mtime: Some(1000),
    };

    let delete_event = FileChange {
        resource: "/test/file.txt".to_string(),
        change_type: FileChangeType::Deleted,
        correlation_id: None,
        mtime: Some(2000),
    };

    let unrelated = FileChange {
        resource: "/test/other.txt".to_string(),
        change_type: FileChangeType::Updated,
        correlation_id: None,
        mtime: Some(3000),
    };

    let result = coalescer.coalesce_events(vec![create_event, delete_event, unrelated.clone()]);
    assert_eq!(result.len(), 1);
    assert_eq!(result[0].change_type, FileChangeType::Updated);
    assert_eq!(result[0].resource, unrelated.resource);
}

#[test]
fn test_coalesce_delete_followed_by_create_becomes_changed() {
    let coalescer = EventCoalescer::new(vec![], vec![]).unwrap();

    let delete_event = FileChange {
        resource: "/test/file.txt".to_string(),
        change_type: FileChangeType::Deleted,
        correlation_id: None,
        mtime: Some(1000),
    };

    let create_event = FileChange {
        resource: "/test/file.txt".to_string(),
        change_type: FileChangeType::Added,
        correlation_id: None,
        mtime: Some(2000),
    };

    let unrelated = FileChange {
        resource: "/test/other.txt".to_string(),
        change_type: FileChangeType::Updated,
        correlation_id: None,
        mtime: Some(3000),
    };

    let result = coalescer.coalesce_events(vec![delete_event, create_event, unrelated.clone()]);
    assert_eq!(result.len(), 2);

    let file_event = result.iter().find(|e| e.resource == "/test/file.txt".to_string()).unwrap();
    assert_eq!(file_event.change_type, FileChangeType::Updated);

    let other_event = result.iter().find(|e| e.resource == "/test/other.txt".to_string()).unwrap();
    assert_eq!(other_event.change_type, FileChangeType::Updated);
}

#[test]
fn test_coalesce_ignore_update_when_create_received() {
    let coalescer = EventCoalescer::new(vec![], vec![]).unwrap();

    let create_event = FileChange {
        resource: "/test/file.txt".to_string(),
        change_type: FileChangeType::Added,
        correlation_id: None,
        mtime: Some(1000),
    };

    let update_event = FileChange {
        resource: "/test/file.txt".to_string(),
        change_type: FileChangeType::Updated,
        correlation_id: None,
        mtime: Some(2000),
    };

    let unrelated = FileChange {
        resource: "/test/other.txt".to_string(),
        change_type: FileChangeType::Updated,
        correlation_id: None,
        mtime: Some(3000),
    };

    let result = coalescer.coalesce_events(vec![create_event, update_event, unrelated.clone()]);
    assert_eq!(result.len(), 2);

    let file_event = result.iter().find(|e| e.resource == "/test/file.txt".to_string()).unwrap();
    assert_eq!(file_event.change_type, FileChangeType::Added);

    let other_event = result.iter().find(|e| e.resource == "/test/other.txt".to_string()).unwrap();
    assert_eq!(other_event.change_type, FileChangeType::Updated);
}

#[test]
fn test_coalesce_apply_delete() {
    let coalescer = EventCoalescer::new(vec![], vec![]).unwrap();

    let update_event = FileChange {
        resource: "/test/file.txt".to_string(),
        change_type: FileChangeType::Updated,
        correlation_id: None,
        mtime: Some(1000),
    };

    let delete_event = FileChange {
        resource: "/test/file.txt".to_string(),
        change_type: FileChangeType::Deleted,
        correlation_id: None,
        mtime: Some(2000),
    };

    let unrelated = FileChange {
        resource: "/test/other.txt".to_string(),
        change_type: FileChangeType::Updated,
        correlation_id: None,
        mtime: Some(3000),
    };

    let result = coalescer.coalesce_events(vec![update_event, delete_event, unrelated.clone()]);
    assert_eq!(result.len(), 2);

    let file_event = result.iter().find(|e| e.resource == "/test/file.txt".to_string()).unwrap();
    assert_eq!(file_event.change_type, FileChangeType::Deleted);

    let other_event = result.iter().find(|e| e.resource == "/test/other.txt".to_string()).unwrap();
    assert_eq!(other_event.change_type, FileChangeType::Updated);
}

#[test]
fn test_coalesce_parent_folder_delete_optimization() {
    let coalescer = EventCoalescer::new(vec![], vec![]).unwrap();

    let folder_delete = FileChange {
        resource: "/test/dir".to_string(),
        change_type: FileChangeType::Deleted,
        correlation_id: None,
        mtime: Some(1000),
    };

    let child_file_delete = FileChange {
        resource: "/test/dir/file.txt".to_string(),
        change_type: FileChangeType::Deleted,
        correlation_id: None,
        mtime: Some(2000),
    };

    let child_subdir_delete = FileChange {
        resource: "/test/dir/subdir".to_string(),
        change_type: FileChangeType::Deleted,
        correlation_id: None,
        mtime: Some(3000),
    };

    let unrelated_file = FileChange {
        resource: "/test/other.txt".to_string(),
        change_type: FileChangeType::Added,
        correlation_id: None,
        mtime: Some(4000),
    };

    let result = coalescer.coalesce_events(vec![
        folder_delete.clone(),
        child_file_delete,
        child_subdir_delete,
        unrelated_file.clone(),
    ]);

    assert_eq!(result.len(), 2);

    // Should only keep the parent folder delete and the unrelated file
    let folder_event = result.iter().find(|e| e.resource == "/test/dir".to_string()).unwrap();
    assert_eq!(folder_event.change_type, FileChangeType::Deleted);

    let other_event = result.iter().find(|e| e.resource == "/test/other.txt".to_string()).unwrap();
    assert_eq!(other_event.change_type, FileChangeType::Added);
}