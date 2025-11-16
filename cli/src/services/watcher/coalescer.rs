/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use crate::services::watcher::types::{FileChange, FileChangeType, file_uri_to_pathbuf};
use globset::{Glob, GlobSet, GlobSetBuilder};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

pub struct EventCoalescer {
    exclude_globs: GlobSet,
    include_globs: GlobSet,
}

impl EventCoalescer {
    pub fn new(excludes: Vec<String>, includes: Vec<String>) -> Result<Self, globset::Error> {
        let mut exclude_builder = GlobSetBuilder::new();
        for pattern in excludes {
            exclude_builder.add(Glob::new(&pattern)?);
        }

        let mut include_builder = GlobSetBuilder::new();
        for pattern in includes {
            include_builder.add(Glob::new(&pattern)?);
        }

        Ok(EventCoalescer {
            exclude_globs: exclude_builder.build()?,
            include_globs: include_builder.build()?,
        })
    }

    /// Coalesce multiple file changes into a minimal set of changes
    /// Following the rules from TypeScript implementation:
    /// - Added+Removed → drop both
    /// - Removed+Added → Changed
    /// - Added+Changed → Added
    /// - Changed+Removed → Removed
    /// - drop child deletes when a parent directory is deleted
    pub fn coalesce_events(&self, events: Vec<FileChange>) -> Vec<FileChange> {
        let mut events_by_resource: HashMap<String, FileChange> = HashMap::new();

        for event in events {
            // Convert resource URI to path for filtering
            let path = match file_uri_to_pathbuf(&event.resource) {
                Ok(p) => p,
                Err(_) => continue, // Skip invalid URIs
            };

            if !self.should_include_path(&path) {
                continue;
            }

            let resource = event.resource.clone();
            if let Some(existing) = events_by_resource.get_mut(&resource) {
                // Coalesce with existing event
                if let Some(coalesced) = self.coalesce_single_event(existing.clone(), event) {
                    *existing = coalesced;
                } else {
                    events_by_resource.remove(&resource);
                }
            } else {
                events_by_resource.insert(resource, event);
            }
        }

        // Parent folder delete optimization: drop child deletes when parent directory is deleted
        let deleted_paths: std::collections::HashSet<PathBuf> = events_by_resource.values()
            .filter(|e| e.change_type == FileChangeType::Deleted)
            .filter_map(|e| file_uri_to_pathbuf(&e.resource).ok())
            .collect();

        let mut final_events = Vec::new();
        for event in events_by_resource.values() {
            if event.change_type == FileChangeType::Deleted {
                if let Ok(path) = file_uri_to_pathbuf(&event.resource) {
                    let mut should_skip = false;
                    for deleted_path in &deleted_paths {
                        if deleted_path != &path && path.starts_with(deleted_path) {
                            // Check if it's a proper child (has components after the parent)
                            if let Ok(stripped) = path.strip_prefix(deleted_path) {
                                if stripped.components().next().is_some() {
                                    should_skip = true;
                                    break;
                                }
                            }
                        }
                    }
                    if should_skip {
                        continue;
                    }
                }
            }
            final_events.push(event.clone());
        }

        final_events
    }

    fn should_include_path(&self, path: &Path) -> bool {
        let path_str = path.to_string_lossy();

        // Check excludes first - if excluded, don't include
        if self.exclude_globs.is_match(&*path_str) {
            return false;
        }

        // If includes are specified, must match at least one
        if !self.include_globs.is_empty() {
            return self.include_globs.is_match(&*path_str);
        }

        // No includes specified, so include by default (after exclude check)
        true
    }

    fn coalesce_single_event(&self, existing: FileChange, new: FileChange) -> Option<FileChange> {
        match (existing.change_type, new.change_type) {
            // Added+Removed → drop both
            (FileChangeType::Added, FileChangeType::Deleted) => None,

            // Removed+Added → Changed
            (FileChangeType::Deleted, FileChangeType::Added) => Some(FileChange {
                resource: existing.resource,
                change_type: FileChangeType::Updated,
                correlation_id: new.correlation_id,
                mtime: new.mtime,
            }),

            // Added+Changed → Added
            (FileChangeType::Added, FileChangeType::Updated) => Some(FileChange {
                resource: existing.resource,
                change_type: FileChangeType::Added,
                correlation_id: new.correlation_id,
                mtime: new.mtime,
            }),

            // Changed+Removed → Removed
            (FileChangeType::Updated, FileChangeType::Deleted) => Some(FileChange {
                resource: existing.resource,
                change_type: FileChangeType::Deleted,
                correlation_id: new.correlation_id,
                mtime: new.mtime,
            }),

            // Same types: keep the most recent
            (FileChangeType::Added, FileChangeType::Added) |
            (FileChangeType::Updated, FileChangeType::Updated) |
            (FileChangeType::Deleted, FileChangeType::Deleted) => Some(FileChange {
                resource: existing.resource,
                change_type: existing.change_type,
                correlation_id: new.correlation_id,
                mtime: new.mtime,
            }),

            // Updated+Added → Updated (most recent wins)
            (FileChangeType::Updated, FileChangeType::Added) => Some(FileChange {
                resource: existing.resource,
                change_type: FileChangeType::Updated,
                correlation_id: new.correlation_id,
                mtime: new.mtime,
            }),

            // Deleted+Updated → Updated
            (FileChangeType::Deleted, FileChangeType::Updated) => Some(FileChange {
                resource: existing.resource,
                change_type: FileChangeType::Updated,
                correlation_id: new.correlation_id,
                mtime: new.mtime,
            }),
        }
    }
}