/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use crate::services::paths::PathNormalizer;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{Semaphore, OwnedSemaphorePermit};
pub struct ResourceLockGuard {
    _permit: OwnedSemaphorePermit,
}

impl Drop for ResourceLockGuard {
    fn drop(&mut self) {
        // debug!("ResourceLockGuard dropped, permit will be released");
    }
}

pub struct ResourceLockManager {
    locks: HashMap<String, Arc<Semaphore>>,
}

impl ResourceLockManager {
    pub fn new() -> Self {
        ResourceLockManager {
            locks: HashMap::new(),
        }
    }

    pub async fn acquire_lock(&mut self, resource_path: &str) -> Result<ResourceLockGuard, Box<dyn std::error::Error + Send + Sync>> {
        let normalized_path = PathNormalizer::normalize(resource_path);
        // debug!("Acquiring lock for resource: {}", normalized_path);

        let semaphore = self.locks
            .entry(normalized_path.clone())
            .or_insert_with(|| Arc::new(Semaphore::new(1)));

        // debug!("Semaphore created/retrieved, acquiring owned permit...");
        // Acquire the owned permit which owns the semaphore directly
        let permit = semaphore.clone().acquire_owned().await?;
        // debug!("Owned permit acquired successfully");
        Ok(ResourceLockGuard { _permit: permit })
    }

    pub fn release_lock(&mut self, resource_path: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let _normalized_path = PathNormalizer::normalize(resource_path);

        // The semaphore automatically releases when the permit is dropped
        // We don't need to do anything here as the guard handles it
        Ok(())
    }

    pub fn is_locked(&self, resource_path: &str) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
        let normalized_path = PathNormalizer::normalize(resource_path);

        if let Some(semaphore) = self.locks.get(&normalized_path) {
            // If available permits is 0, it's locked
            Ok(semaphore.available_permits() == 0)
        } else {
            Ok(false)
        }
    }
}